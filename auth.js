// Info: Auth library. Authorisation and Session management
'use strict';

// Shared Dependencies (Managed by Loader)
var Lib = {};

// Private Dependencies - Parts of same library (Managed by Loader)
var AuthInput;
var AuthData;

// Exclusive Dependencies
var CONFIG = require('./config'); // Loader can override it with Custom-Config


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Load dependencies and configurations

  @param {Set} shared_libs - Reference to libraries already loaded in memory by other modules
  @param {Set} config - Custom configuration in key-value pairs

  @return nothing
  *********************************************************************/
  const loader = function(shared_libs, config){

    // Shared Dependencies (Must be loaded in memory already)
    Lib.Utils = shared_libs.Utils;
    Lib.Debug = shared_libs.Debug;
    Lib.Crypto = shared_libs.Crypto;
    Lib.Instance = shared_libs.Instance;
    Lib.HttpHandler = shared_libs.HttpHandler;
    Lib.DynamoDB = shared_libs.DynamoDB;

    // Override default configuration
    if( !Lib.Utils.isNullOrUndefined(config) ){
      Object.assign(CONFIG, config); // Merge custom configuration with defaults
    }

    // Private Dependencies
    AuthInput = require('./auth_input')(Lib, CONFIG);
    AuthData = require('./auth_data')(Lib, CONFIG);

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function(shared_libs, config){

  // Run Loader
  loader(shared_libs, config);

  // Return Public Funtions of this module
  return [Auth, AuthInput, AuthData];

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const Auth = { // Public functions accessible by other modules

  /********************************************************************
  Create and Initialize a new session.
  Also sets Auth Cookie instructions in HTTP Response.

  @param {reference} instance - Request Instance object reference
  @param {requestCallback} cb - Callback function

  @param {String} partition_id - Root Partition namespace for which this session is generated (App-ID, Organisation-ID, ...)
  @param {String} actor_type - Actor-Type to whom this session is being created (user|admin|customer|...)
  @param {String} actor_id - Actor-ID for whom this session is being created
  @param {Integer} platform_code - Auth Platform Code
  @param {String} [site_id] - (Optional) Site ID for which this session is being created. Each instance of client app is new Site
  @param {Set} [client_info] - (Optional) Client-Info
  * @param {String} client_name - Client Name
  * @param {String} client_version - Client Version
  * @param {Boolean} is_browser - Client Is Browser
  * @param {Integer} screen_width - Client Screen Width
  * @param {Integer} screen_height - Client Screen Height
  * @param {String} os_name - Client OS
  * @param {String} os_version - Client OS-Version
  * @param {String} ip_address - Client IP-Address

  @return Thru request Callback.

  @callback - Request Callback
  * @callback {Error} err - Unable to connect to session-database
  * @callback {String} auth_id - Auth-ID (ActorId-TokenKey-TokenSecret)
  *********************************************************************/
  start: function(instance, cb, partition_id, actor_type, actor_id, platform_code, site_id, client_info){

    // Generate auth data
    const new_auth_data = _Auth.createAuthData(
      actor_id,
      _Auth.generateAuthKey(actor_id), // Newly generated Auth-Key
      _Auth.generateAuthSecret(actor_id) // Newly generated Auth-Secret
    );

    // Construct Auth-ID
    const new_auth_id = _Auth.createAuthId(new_auth_data);

    // Construct Session-ID
    const new_session_id = _Auth.createSessionId(actor_type, new_auth_data);

    // Construct Session-data object
    const new_session_data = AuthData.createSessionData(
      partition_id,
      actor_id, // Owner of session
      new_session_id, // Session ID
      platform_code, // App Platform code
      site_id, // Site on which this session is created
      instance['time'], // Session Time of Creation (Unix Timestamp)
      instance['time'] + CONFIG.ACTOR[actor_type].TTL, // Session Expirey
      instance['time'], // Session Time of Last Accessed (Unix Timestamp)
    );


    // Add Client-Info
    if( !Lib.Utils.isEmpty(client_info) ){
      new_session_data['screen_width'] = Lib.Utils.fallback(client_info['screen_width']); // Client Screen Width
      new_session_data['screen_height'] = Lib.Utils.fallback(client_info['screen_height']); // Client Screen Height
      new_session_data['client_name'] = Lib.Utils.fallback(client_info['client_name']); // Client
      new_session_data['client_version'] = Lib.Utils.fallback(client_info['client_version']); // Client Version
      new_session_data['is_browser'] = Lib.Utils.fallback(client_info['is_browser']); // Client Is Browser
      new_session_data['os_name'] = Lib.Utils.fallback(client_info['os_name']); // Client OS
      new_session_data['os_version'] = Lib.Utils.fallback(client_info['os_version']); // Client OS-Version
      new_session_data['ip_address'] = Lib.Utils.fallback(client_info['ip_address']); // Client IP-Address
    }


    // Save session-data to instance object
    instance['session'] = new_session_data;


    // Check if Session Count is reached and automatically delete least accessed session
    _Auth.checkSessionCountAndRemoveLeastAccessedSessionFromDynamoDb(
      instance,
      function(err){

        if(err){ // Session Server Error
          return cb(err); // Stop Execution. API-Response with error is already handled inside Session function
        }


        // reach here means all good

        // Add New Session Entry to Session Database
        _Auth.setSessionDataInDynamoDb(
          instance,
          function(err){

            if(err){ // Session Server Error
              return cb(err); // Stop Execution. API-Response with error is already handled inside Session function
            }

            // Set Auth-Cookie in Browser
            _Auth.setAuthCookie( instance, partition_id, actor_type, new_auth_id );


            // Invoke Callback with new-auth-id
            cb(null, new_auth_id);

          },
          partition_id,
          actor_type,
          new_session_data
        );

      },
      partition_id,
      actor_type,
      actor_id
    );

  },


  /********************************************************************
  Verify if Auth-Data is for valid session.

  @param {reference} instance - Request Instance object reference
  @param {requestCallback} cb - Callback function
  @param {String} partition_id - Root Partition namespace for which this auth is being done (App-ID, Organisation-ID, ...)
  @param {String} actor_type - Actor-Type to which this auth data belongs to (user|admin|customer|...)

  @return - Thru Callback

  @callback - Request Callback
  * @callback {Error} err - Unable to connect to session-database
  * @callback {Boolean} response - false if Invalid Session
  * @callback {Boolean} response - true valid session found
  *********************************************************************/
  verify: function(instance, cb, partition_id, actor_type){

    // Auth-Data recieved from client
    var auth_data = {};

    // Session-Data for this auth-request
    var session_data = {};

    // Construct Cookie Name
    const cookie_name = CONFIG.ACTOR[actor_type].COOKIE_PREFIX + partition_id;

    // Flags for storing properties
    var is_cookie_based_auth = false;
    var is_session_database_writable = false;


    // Extract Auth Data from Header or Cookie or Request-Data

    // [Priority 1] If Auth Data is set by a Pre-Auth Service
    if( instance['auth_data'] ){

      // Get auth data from Pre-Auth information inside 'instance'
      auth_data = _Auth.getAuthDataFromPreAuthService( instance['auth_data'] );

    }

    // [Priority 2] If Auth Data is set in Bearer Authorization of HTTP Request
    else if(
      CONFIG.BEARER_HEADER_NAME in instance['http_request']['headers'] && // Check if token is sent in Header
      !Lib.Utils.isNull(instance['http_request']['headers'][CONFIG.BEARER_HEADER_NAME]) // Should not be null
    ){

      // Get Auth data from HTTP 'authorization' header inside 'instance'
      auth_data = _Auth.getAuthDataFromBearerHeader( instance['http_request']['headers'][CONFIG.BEARER_HEADER_NAME] );

    }

    // [Priority 3] If Auth Data is set in Headers of HTTP Request
    else if(
      CONFIG.AUTH_HEADER_NAME in instance['http_request']['headers'] && // Check if token is sent in Header
      !Lib.Utils.isNull(instance['http_request']['headers'][CONFIG.AUTH_HEADER_NAME]) // Should not be null
    ){

      // Get Auth data from HTTP request headers inside 'instance'
      auth_data = _Auth.getAuthDataFromRequestHeader( instance['http_request']['headers'][CONFIG.AUTH_HEADER_NAME] );

    }

    // [Priority 4] If Auth Data is set in Cookies of HTTP Request
    else if(
      cookie_name in instance['http_request']['cookies'] && // Check if cookie is sent
      !Lib.Utils.isNull(instance['http_request']['cookies'][cookie_name]) // Should not be null
    ){

      // This is cookie based authention
      is_cookie_based_auth = true;

      // Get Auth data from HTTP request cookies inside 'instance'
      auth_data = _Auth.getAuthDataFromCookie( instance['http_request']['cookies'][cookie_name] );

    }

    // [Fallback] No Auth Data Found
    else{
      return cb(null, false); // Session doesnot exist
    }



    // Get Session-Data for this Auth-data

    // [Priority 1] If Session-Data is already set by a Pre-Auth Service
    if(
      'auth_data' in instance && // Check if sent in Header
      instance['auth_data']['custom_data']
    ){

      // Get Session Data from already flattened session-data in pre-auth
      session_data = _Auth.getSessionDataFromPreAuthService( instance['auth_data']['custom_data'] );

      // Function to process session-data
      proceedWithSessionData(null, session_data);

    }

    // [Priority 2] Session-Data source is local JSON DB
    else if( CONFIG.ACTOR[actor_type].DB_TYPE == 'json' ){

      // Get Session Data from Static-JSON
      session_data = _Auth.getSessionDataFromJsonDb( partition_id, actor_type, auth_data, CONFIG.ACTOR[actor_type].DB_SOURCE );

      // Function to process session-data
      proceedWithSessionData(null, session_data);

    }

    // [Priority 3] Session-Data source is Dynamo DB
    else if( CONFIG.ACTOR[actor_type].DB_TYPE == 'dynamodb' ){

      // This Session database is writable
      is_session_database_writable = true;

      // Get session data from dynamodb
      _Auth.getSessionDataFromDynamoDb(
        instance,
        proceedWithSessionData, // Callback function to process session-data
        partition_id,
        actor_type,
        auth_data,
        CONFIG.ACTOR[actor_type].DB_SOURCE
      )

    }

    // [Fallback] Unknown Datasource
    else{

      return cb( // Return Error
        Error(CONFIG.UNKNOWN_DATA_SOURCE.CODE)
      );

    }


    // Callback function which recives session-data and processes it
    function proceedWithSessionData(err, session_data){

      if(err){ // Session-Database Error
        return cb(err); // Return Error
      }

      if(!session_data){ // Sesion data not found in Session-Database

        // Remove Bad Cookie
        if( is_cookie_based_auth ){
          _Auth.deleteAuthCookie( instance, partition_id, actor_type );
        }

        // Session data not found against this auth-data
        return cb(null, false);

      }


      // Reach here means all good

      // Set this session-data in instance
      instance['session'] = session_data;


      // Reset cookie expiry time
      if(
        is_cookie_based_auth &&
        (instance['time'] - session_data['tola']) > CONFIG.ACTOR[actor_type].TOLA_INTERVAL
      ){
        _Auth.setAuthCookie(
          instance,
          partition_id,
          actor_type,
          _Auth.createAuthId(auth_data)
        );
      }


      // Invoke Callback with success in response
      cb(null, true);


      // Update Session Last accessed time - In background (only if it's not been updated in last 1 hour)
      // Only if Database source is Writable
      if(
        is_session_database_writable &&
        (instance['time'] - session_data['tola']) > CONFIG.ACTOR[actor_type].TOLA_INTERVAL
      ){

        // Create a background process in 'instance'
        const background_function_cleanup = Lib.Instance.backgroundRoutine(instance);

        // Update Session's time of last accessed
        _Auth.updateSessionLastAccessedTimeDynamoDB(
          partition_id,
          session_id_hashed, // This Session-ID
          instance,
          function(err, response){

            // Since it's a background process, do nothing in case of error. Do nothing with response.

            // Background function finished
            background_function_cleanup(instance);

          }
        );

      }

    }

  },


  /********************************************************************
  Remove Session-Data From Database (Using Full Session-ID)
  (Also removes cookie for this session)

  @param {reference} instance - Request Instance object reference
  @param {requestCallback} cb - Callback function

  @param {String} partition_id - Root Partition namespace (App-ID, Organisation-ID, ...)
  @param {String} actor_type - Actor-Type to which this auth data belongs to (user|admin|customer|...)
  @param {String} session_id - Session-ID to be removed

  @return - Thru Callback

  @callback - Request Callback
  * @callback {Error} err - Unable to connect to session-database
  *********************************************************************/
  remove: function(instance, cb, partition_id, actor_type, session_id){

    // Remove Session data only if Session-ID is not null
    if( session_id ){

      // Remove Cookie
      _Auth.deleteAuthCookie(instance, partition_id, actor_type);

      // Remove session data from database
      _Auth.deleteSessionDataFromDynamoDb(
        instance,
        cb,                 // forward orignal callback
        partition_id,
        actor_type,
        session_id          // Session-ID to be removed
      );

    }
    else{
      cb(null); // Nothing to destroy. Invoke callback without any error
    }

  },


  /********************************************************************
  Remove Session-Data From Database (Using Full Session-ID)
  (for session other then this session)

  @param {reference} instance - Request Instance object reference
  @param {requestCallback} cb - Callback function

  @param {String} partition_id - Root Partition namespace (App-ID, Organisation-ID, ...)
  @param {String} actor_type - Actor-Type to which this auth data belongs to (user|admin|customer|...)
  @param {String} session_id - Session-ID to be removed

  @return - Thru Callback

  @callback - Request Callback
  * @callback {Error} err - Unable to connect to session-database
  *********************************************************************/
  removeOtherSession: function(instance, cb, partition_id, actor_type, session_id){

    // Remove Session data only if Session-ID is not null
    if( session_id ){

      // Remove session data from database
      _Auth.deleteSessionDataFromDynamoDb(
        instance,
        cb,                 // forward orignal callback
        partition_id,
        actor_type,
        session_id          // Session-ID to be removed
      );

    }
    else{
      cb(null); // Nothing to destroy. Invoke callback without any error
    }

  },


  /********************************************************************
  Remove All Sessions Data From Database for an Actor
  ( Cookie is not deleted )

  @param {reference} instance - Request Instance object reference
  @param {requestCallback} cb - Callback function

  @param {String} partition_id - Root Partition namespace (App-ID, Organisation-ID, ...)
  @param {String} actor_type - Actor-Type to which this auth data belongs to (user|admin|customer|...)
  @param {String} actor_id - Actor-ID to whose sessions are to be deleted

  @return - Thru Callback

  @callback - Request Callback
  * @callback {Error} err - Unable to connect to session-database
  *********************************************************************/
  removeAll: function(instance, cb, partition_id, actor_type, actor_id){

    // Fetch All Sessions from DynamoDB
    _Auth.getSessionsListFromDynamoDbUsingActorId(
      instance,
      function(err, sessions_list){

        // If Error
        if(err){ // Session-Database Error
          return cb(err); // Return Error
        }


        // reach here means all good

        // Delete Sessions From Database
        _Auth.deleteSessionsDataFromDynamoDb(
          instance,
          cb, // return as-it-is
          sessions_list,
          actor_type
        );

      },
      partition_id,
      actor_type,
      actor_id
    );

  },


  /********************************************************************
  Remove All Sessions Data From Database for an Actor

  @param {reference} instance - Request Instance object reference
  @param {requestCallback} cb - Callback function

  @param {String} partition_id - Root Partition namespace (App-ID, Organisation-ID, ...)
  @param {String} actor_type - Actor-Type to which this auth data belongs to (user|admin|customer|...)
  @param {String} actor_id - Actor-ID to whose sessions are to be deleted

  @return - Thru Callback

  @callback - Request Callback
  * @callback {Error} err - Sessions not found or Unable to reach session database
  * @callback {Map[]} response_list - Session-List
  * @callback {Boolean} response - False if key not found
  *********************************************************************/
  getSessions: function(instance, cb, partition_id, actor_type, actor_id){

    // Fetch All Sessions from DynamoDB
    _Auth.getSessionsListFromDynamoDbUsingActorId(
      instance,
      cb, // return as-it-is
      partition_id,
      actor_type,
      actor_id
    );

  }

};///////////////////////////Public Functions END///////////////////////////////



//////////////////////////Private Functions START///////////////////////////////
const _Auth = { // Private functions accessible within this modules only

  /********************************************************************
  Return Auth-Data object after extracting data from Pre-Authorizer Service

  @param {Map} data_source - Data source from where auth-data can be extracted

  @return {Map} - Auth Data Object in key-value
  @return {Boolean} - False if auth-data is malformed or not found
  *********************************************************************/
  getAuthDataFromPreAuthService: function(data_source){

    // Check if source has relevent data in it
    if(
      !Lib.Utils.isNullOrUndefined(data_source) && // Non-empty source-data
      'token' in data_source && // 'token' key exists in source-data
      !Lib.Utils.isNull( data_source['token'] )
    ){

      // Extract token from Bearer Token text
      const token = _Auth.getTokenFromBearerToken( data_source['token'] );

      // Sanitize Auth ID
      token = AuthInput.sanitizeAuthID( token );

      // Split combined string sent as token
      var data_arr = token.split('-'); // Break combined string -> ActorId-TokenKey-TokenSecret


      // Return auth-data object
      return _Auth.createAuthData( // Create Auth Data Object by mapping to corresponding data
        data_arr[0], // Actor-ID
        data_arr[1], // Token-Key
        data_arr[2], // Token-Secret
      );

    }

    // In case of malformed data or missing data
    else{
      return false // Return false
    }

  },


  /********************************************************************
  Return Auth-Data object after extracting data from Bearer Authorization Header

  @param {String} data_source - Data source from where auth-data can be extracted

  @return {Map} - Auth Data Object in key-value
  *********************************************************************/
  getAuthDataFromBearerHeader: function(data_source){

    // Extract token from Bearer Token text
    var token = _Auth.getTokenFromBearerToken( data_source );

    // Sanitize Auth ID
    token = AuthInput.sanitizeAuthID( token );

    // Split combined string sent as token
    var data_arr = token.split('-'); // Break combined string -> ActorId-TokenKey-TokenSecret


    // Return auth data object
    return _Auth.createAuthData( // Create Auth Data Object by mapping to corresponding data
      data_arr[0], // Actor-ID
      data_arr[1], // Token-Key
      data_arr[2], // Token-Secret
    );

  },


  /********************************************************************
  Return Auth-Data object after extracting data from HTTP Request Headers

  @param {String} data_source - Data source from where auth-data can be extracted

  @return {Map} - Auth Data Object in key-value
  *********************************************************************/
  getAuthDataFromRequestHeader: function(data_source){

    // Sanitize Auth ID
    data_source = AuthInput.sanitizeAuthID( data_source );

    // Split combined string sent as token
    var data_arr = data_source.split('-'); // Break combined string -> ActorId-TokenKey-TokenSecret


    // Return auth data object
    return _Auth.createAuthData( // Create Auth Data Object by mapping to corresponding data
      data_arr[0], // Actor-ID
      data_arr[1], // Token-Key
      data_arr[2], // Token-Secret
    );

  },


  /********************************************************************
  Return Auth-Data object after extracting data from Cookie

  @param {String} data_source - Data source from where auth-data can be extracted

  @return {Map} - Auth Data Object in key-value
  *********************************************************************/
  getAuthDataFromCookie: function(data_source){

    // Sanitize Auth ID
    data_source = AuthInput.sanitizeAuthID( data_source );

    // Split combined string sent as cookie
    var data_arr = data_source.split('-'); // Break combined string -> ActorId-TokenKey-TokenSecret


    // Return auth data object
    return _Auth.createAuthData( // Create Auth Data Object by mapping to corresponding data
      data_arr[0], // Actor-ID
      data_arr[1], // Token-Key
      data_arr[2], // Token-Secret
    );

  },


  /********************************************************************
  Extract token from Bearer-Token string

  @param {String} bearer_token - Text with bearer token

  @return {String} - Only Token part from Bearer Token. (Return token as-it-is in case it's not Bearer Token)
  *********************************************************************/
  getTokenFromBearerToken: function(bearer_token){

    // Extract first string after 'Bearer '.
    return bearer_token.split('Bearer ').pop(); // Ex. "Bearer TheSpecialTokenWeNeed"

  },


  /********************************************************************
  Return Session-Data object after extracting data from Pre-Authorizer Service

  @param {Map} data_source - Data source from where session-data can be extracted

  @return {Map} - Session Data Object in key-value
  *********************************************************************/
  getSessionDataFromPreAuthService: function(data_source){

    // Convert flattened Session-Data into JSON
    return Lib.Utils.stringToJSON(data_source); // Return Session-Data

  },


  /********************************************************************
  Return Session-Data object from local JSON Database

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to
  @param {Map} auth_data - Auth Data for which Session Data is to be fetched

  @return {Map} - Session Data Object in key-value
  @return {Boolean} - False if Session-Data not found
  *********************************************************************/
  getSessionDataFromJsonDb: function(partition_id, actor_type, auth_data){

    // Create Session ID
    const session_id = _Auth.createSessionId(actor_type, auth_data);

    // Data Source
    var data_source = CONFIG.ACTOR[actor_type].DB_SOURCE;


    // Check if Session data is available for this Session-Key
    if( !(session_id in data_source) ){
      return false; // Return false if session not found
    }


    // Build and Return Session-Data Object
    return AuthData.createSessionData(
      partition_id, // Partition-Id
      auth_data['actor_id'], // Owner of session
      session_id, // Session ID
      data_source[session_id]['pc'], // Client app Platform-Code
      data_source[session_id]['stid'], // Site on which this session is created. Each instance of client app is new Site
      data_source[session_id]['toc'], // Session Time of Creation
      null, // No expiry in json based db
      null // No time of last accessed in json based db
    );

  },


  /********************************************************************
  Get Session-Data for corrosponding Auth-Data from session database at DynamoDB

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to
  @param {Map} auth_data - Auth Data for which Session Data is to be fetched

  @return Thru request Callback

  @callback - Request Callback
  * @callback {Error} err - Session not found or Unable to reach session database
  * @callback {Map} response - Session-Data
  * @callback {Boolean} response - False if key not found
  *********************************************************************/
  getSessionDataFromDynamoDb: function(instance, cb, partition_id, actor_type, auth_data){

    // Create Session ID
    const session_id = _Auth.createSessionId(actor_type, auth_data);

    // NO-DB Record ID
    var record_id = {
      'p': partition_id,
      'sid': session_id
    };

    // Get data from dynamodb
    Lib.DynamoDB.getRecord(
      instance,
      function(err, session_data){ // Callback function

        if(err){ // Session Server Error
          return cb(err); // Stop Execution. Invoke callback with error
        }


        // Data returned
        if(session_data){

          cb( // Return Data - Invoke callback
            null, // No error
            AuthData.createSessionData( // Construct and return session-data
              partition_id, // Partition-Id
              auth_data['actor_id'], // Owner of session
              session_id, // Session ID
              session_data['pc'], // Client app Platform-Code
              session_data['stid'] || null, // Site on which this session is created (Default Null)
              session_data['toc'], // Session Time of Creation
              session_data['toe'], // Session Time of Expiration
              session_data['tola'], // Session Time of Last access
              session_data['cl_n'], // Client Name
              session_data['cl_v'], // Client Version
              session_data['cl_ib'], // Client Is Browser
              session_data['cl_w'], // Client Screen Width
              session_data['cl_h'], // Client Screen Height
              session_data['cl_os'], // Client OS Name
              session_data['cl_osv'], // Client OS-Version
              session_data['cl_ip'], // Client IP-Address
            )
          );

        }
        else{ // No Data Returned
          cb(null, false); // Invoke callback with false as response
        }

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // Table Name
      record_id // Record ID for fetching data
    );

  },


  /********************************************************************
  Get Session-List for corrosponding Actor from session database at DynamoDB

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to
  @param {String} actor_id - Actor-ID to whose sessions are to be fetched

  @return Thru request Callback

  @callback - Request Callback
  * @callback {Error} err - Sessions not found or Unable to reach session database
  * @callback {Map[]} response_list - Session-List
  * @callback {Boolean} response - False if key not found
  *********************************************************************/
  getSessionsListFromDynamoDbUsingActorId: function(instance, cb, partition_id, actor_type, actor_id){

    // Get Data-List from dynamodb
    Lib.DynamoDB.queryRecords(
      instance,
      function(err, sessions_list){ // Callback function

        if(err){ // Session Server Error
          return cb(err); // Stop Execution. Invoke callback with error
        }


        // reach here means all good

        // Data returned
        if( sessions_list ){

          // Translate Sessions List
          var response = sessions_list.map(function(session_data){
            return AuthData.createSessionData( // Construct and return session-data
              partition_id, // Partition-Id
              actor_id, // Owner of session
              session_data['sid'], // Session ID
              session_data['pc'], // Client app Platform-Code
              session_data['stid'] || null, // Site on which this session is created (Default Null)
              session_data['toc'], // Session Time of Creation
              session_data['toe'], // Session Time of Expiration
              session_data['tola'], // Session Time of Last access
              session_data['cl_n'], // Client Name
              session_data['cl_v'], // Client Version
              session_data['cl_ib'], // Client Is Browser
              session_data['cl_w'], // Client Screen Width
              session_data['cl_h'], // Client Screen Height
              session_data['cl_os'], // Client OS Name
              session_data['cl_osv'], // Client OS-Version
              session_data['cl_ip'], // Client IP-Address
            );
          });

          cb( // Return Data - Invoke callback
            null, // No error
            response
          );

        }
        else{ // No Data Returned
          cb(null, false); // Invoke callback with false as response
        }

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // Table Name
      null, // no secondary index
      'p', // Partition Key
      partition_id, // Partition Value
      null, // feilds_list
      null, // paging
      { // Condition
        operator  : "begins_with",
        key       : "sid",
        value     : actor_id,
        asc       : true
      }
    );

  },


  /********************************************************************
  Delete all Sessions for corrosponding Sessions List from session database at DynamoDB
  Can Only delete session for Specific Actor Type

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} sessions_list - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to

  @return Thru request Callback

  @callback - Request Callback(err, is_success)
  * @callback {Error} err - In case of error
  * @callback {Boolean} is_success - true on successful (all sessions deleted)
  * @callback {Boolean} is_success - false on unsuccessful (sessions not deleted)
  *********************************************************************/
  deleteSessionsDataFromDynamoDb: function(instance, cb, sessions_list, actor_type){

    // If no Sessions (Do not proceed)
    if(
      !sessions_list ||
      Lib.Utils.isEmpty(sessions_list)
    ){
      return cb( null, true );
    }

    // Iterate Sessions List and create record ids to be deleted
    var record_ids = sessions_list.map(function(session_data){
      return {
        'p': session_data['partition_id'],
        'sid': session_data['session_id']
      };
    });


    // Delete Sessions
    Lib.DynamoDB.deleteBatchRecords(
      instance,
      cb, // return as-it-is
      [ CONFIG.ACTOR[actor_type].DB_SOURCE ], // Table Names
      [ record_ids ] // Record IDs for fetching data
    );

  },


  /********************************************************************
  Delete Session if maximum allowed session count reached for corrosponding Session from session database at DynamoDB
  Can Only delete session for Specific Actor Type

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to
  @param {String} actor_id - Actor-ID to whose sessions are to be fetched

  @return Thru request Callback

  @callback - Request Callback. No Response, only error
  * @callback {Error} err - Unable to reach session database
  *********************************************************************/
  checkSessionCountAndRemoveLeastAccessedSessionFromDynamoDb: function(instance, cb, partition_id, actor_type, actor_id){

    // Fetch All Sessions from DynamoDB
    _Auth.getSessionsListFromDynamoDbUsingActorId(
      instance,
      function(err, sessions_list){

        // If Error
        if(err){ // Session-Database Error
          return cb(err); // Return Error
        }


        // reach here means all good

        // Initialize
        var session_count = 0;
        if( sessions_list ){ // If Sessions List present
          session_count = sessions_list.length;
        }

        // Check If Session Count Reached
        if( session_count >= CONFIG.ACTOR[actor_type].SESSION_LIMIT ){

          // Sort Sessions List By Time of Last Accessed (Descending)
          sessions_list = sessions_list.sort(function(a, b){
            return b['time_of_last_accessed'] - a['time_of_last_accessed'];
          })

          // Session to be deleted (Pop Last Item in Sessions List)
          var session_data = sessions_list.pop();

          // Remove session data from database
          _Auth.deleteSessionDataFromDynamoDb(
            instance,
            cb, // forward orignal callback
            partition_id,
            actor_type,
            session_data['session_id'] // Session-ID to be removed
          );

        }
        else{ // no need to delete session if limit not reached
          // Invoke callback without any error
          return cb(null);
        }

      },
      partition_id,
      actor_type,
      actor_id
    );

  },


  /********************************************************************
  Add/Update(over-write) Item in session-databse

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to
  @param {Map} session_data - Session data

  @return Thru request Callback.

  @callback - Request Callback. No Response, only error
  * @callback {Error} err - Unable to reach session database
  *********************************************************************/
  setSessionDataInDynamoDb: function(instance, cb, partition_id, actor_type, session_data){

    // Create Session Record Object that is to be saved in Database
    const db_record = {
      'p': partition_id,
      'sid': session_data['session_id'],
      'aid': session_data['actor_id'],
      'pc': session_data['platform_code'],
      'toc': session_data['time_of_creation'],
      'toe': session_data['time_of_expiry'],
      'tola': session_data['time_of_last_accessed'],
      'cl_n': session_data['client_name'],
      'cl_v': session_data['client_version'],
      'cl_ib': session_data['is_browser'],
      'cl_w': session_data['screen_width'],
      'cl_h': session_data['screen_height'],
      'cl_os': session_data['os_name'],
      'cl_osv': session_data['os_version'],
      'cl_ip': session_data['ip_address'],
    };

    // Optional Data
    if( session_data['site_id'] ){
      db_record['stid'] = session_data['site_id'];
    }

    // Get data from dynamodb
    Lib.DynamoDB.addRecord(
      instance,
      function(err, is_success){ // Callback function

        if(err){ // Session Database Error
          return cb(err); // Invoke callback with error
        }

        if(!is_success){ // Session Database Error
          return cb(Error(CONFIG.DATABASE_WRITE_FAILED)); // Invoke callback with error
        }

        // Invoke callback without any error
        cb(null);

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // Table Name
      db_record // Record to be saved in database
    );

  },


  /********************************************************************
  Delete Item from session-databse

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this auth data belongs to
  @param {Map} session_id - Session-ID

  @return Thru request Callback.

  @callback - Request Callback. No Response, only error
  * @callback {Error} err - Unable to reach session database
  *********************************************************************/
  deleteSessionDataFromDynamoDb: function(instance, cb, partition_id, actor_type, session_id){

    // NO-DB Record ID
    var record_id = {
      'p': partition_id,
      'sid': session_id
    };


    // Delete data from dynamodb
    Lib.DynamoDB.deleteRecord(
      instance,
      function(err, is_success){ // Callback function

        if(err){ // Session Database Error
          return cb(err); // Invoke callback with error
        }

        if(!is_success){ // Session Database Error
          return cb(Error(CONFIG.DATABASE_WRITE_FAILED)); // Invoke callback with error
        }

        // Invoke callback without any error
        cb(null);

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // Table Name
      record_id // Record-ID of record to be deleted from database
    );

  },


  /********************************************************************
  Update this session's Time of Last Access in session database at DynamoDB

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this session data belongs to
  @param {Map} session_data - Session Data which is to be updated

  @return Thru request Callback

  @callback - Request Callback. No Response. Error is ignored in case Updating Last Accessed time fails
  *********************************************************************/
  updateSessionLastAccessedTimeDynamoDB: function(instance, cb, partition_id, actor_type, session_data){

    // Create Session ID
    const session_id = session_data['session_id'];

    // NO-DB Record ID
    var record_id = {
      'p': partition_id,
      'sid': session_id
    };

    // Create Partial Session Data for this session
    var updated_session_data = {
      'tola': instance['time'], // Current time as time of last Accessed
      'toe': instance['time'] + CONFIG.ACTOR[actor_type].TTL // Extend Session TTL
    };


    // Update session data in dynamodb
    Lib.DynamoDB.updateRecord(
      instance,
      function(err, response){ // Callback function

        if(err){ // Session Database Error
          return cb(err); // Invoke callback with error
        }

        // Invoke callback without any error
        cb(null);

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // DynamoDB Table
      record_id, // Record ID whose data is to be updated
      updated_session_data // Updated data
    );

  },


  /********************************************************************
  Set Session Cookie to be sent in HTTP Response

  @param {reference} instance - Request Instance object reference
  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this session data belongs to
  @param {String} auth_id - Auth-ID to be set

  @return {undefined} - None
  *********************************************************************/
  setAuthCookie: function(instance, partition_id, actor_type, auth_id){

    Lib.HttpHandler.setCookie(
      instance,
      CONFIG.ACTOR[actor_type].COOKIE_PREFIX + partition_id, // Cookie Name (Unique cookie name for each partition, so we can have multiple cookies for each partition under same domain)
      auth_id, // Cookie Value
      CONFIG.ACTOR[actor_type].TTL // Persistant Cookie that expires after specific time
    );

  },


  /********************************************************************
  Set instruction to delete Session Cookie to be sent in HTTP Response

  @param {reference} instance - Request Instance object reference
  @param {String} partition_id - Root Partition namespace
  @param {String} actor_type - Actor-Type to which this session data belongs to

  @return {undefined} - None
  *********************************************************************/
  deleteAuthCookie: function(instance, partition_id, actor_type){

    // Set cookie expirey to '0' to expire it immediately
    Lib.HttpHandler.setCookie(
      instance,
      CONFIG.ACTOR[actor_type].COOKIE_PREFIX + partition_id, // Cookie Name (Unique cookie name for each partition, so we can have multiple cookies for each partition under same domain)
      '', // Cookie Value - Empty String
      0 // Cookie Expiry - setting to 0 means delete
    );

  },


  /********************************************************************
  Create Auth-Id from Auth-Data

  @param {Map} auth_data - Auth-Data

  @return {String} - Auth-ID (ActorID-TokenKey-TokenSecret)
  *********************************************************************/
  createAuthId: function(auth_data){

    return (auth_data['actor_id'] + '-' + auth_data['token_key'] + '-' + auth_data['token_secret'])

  },


  /********************************************************************
  Return a Auth-Data object

  @param {String} actor_id - Owner of this Auth Data
  @param {String} token_key - Token 'Key'
  @param {String} token_secret - Token 'Secret'

  @return {Map} - Auth Data Object in key-value
  *********************************************************************/
  createAuthData: function(actor_id, token_key, token_secret){

    return {
      'actor_id'      : actor_id, // Owner of this auth data
      'token_key'     : token_key, // Token-Key
      'token_secret'  : token_secret, // Token-Secret
    };

  },


  /********************************************************************
  Create Session-Id from Auth-Data

  @param {String} actor_type - Actor Type to whom this auth data belongs to
  @param {Map} auth_data - Auth-Data

  @return {String} - Session-ID (ActorID.TokenKey.TokenSecretHash)
  *********************************************************************/
  createSessionId: function(actor_type, auth_data){

    // Create Token-Secret Hash
    const token_secret_hash = _Auth.getTokenSecretHash(
      auth_data['token_secret'],
      CONFIG.ACTOR[actor_type].HASH_SALT
    );


    // Session ID
    return (auth_data['actor_id'] + '.' + auth_data['token_key'] + '.' + token_secret_hash)

  },


  /********************************************************************
  Generate Highly Random Auth-Key

  @param {String} actor_id - For future use. Maybe used as salt or namesapace.

  @return {String} - Auth key
  *********************************************************************/
  generateAuthKey: function(actor_id){

    return Lib.Crypto.generateRandomString(CONFIG.RANDOMIZER_CHARSET, CONFIG.TOKEN_KEY_LENGTH); // Generate random string

  },


  /********************************************************************
  Generate Highly Random Auth-Secret

  @param {String} actor_id - For future use. Maybe used as salt or namesapace.

  @return {String} - Auth key
  *********************************************************************/
  generateAuthSecret: function(actor_id){

    return Lib.Crypto.generateRandomString(CONFIG.RANDOMIZER_CHARSET, CONFIG.TOKEN_SECRET_LENGTH); // Generate random string

  },


  /********************************************************************
  Get hash value of Token-Secret (Token-Secret are saved into database after hashing)

  @param {String} token_secret - Token-Secret whose hash is to be calculated
  @param {String} salt - Salt for hashing

  @return {String} - Session hash. 32 hex chars
  *********************************************************************/
  getTokenSecretHash: function(token_secret, salt){

    return Lib.Crypto.md5String( token_secret + salt ); // Generate MD5 hash

  },

};//////////////////////////Private Functions END//////////////////////////////
