// Info: Contains Functions Related to Auth Data-Structures
'use strict';

// Shared Dependencies (Managed by Main Entry Module & Loader)
var Lib;

// Exclusive Dependencies
var CONFIG; // (Managed by Main Entry Module & Loader)


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Load dependencies and configurations

  @param {Set} shared_libs - Reference to libraries already loaded in memory by other modules
  @param {Set} config - Custom configuration in key-value pairs

  @return nothing
  *********************************************************************/
  const loader = function(shared_libs, config){

    // Shared Dependencies (Managed my Main Entry Module)
    Lib = shared_libs;

    // Configuration (Managed my Main Entry Module)
    CONFIG = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function(shared_libs, config){

  // Run Loader
  loader(shared_libs, config);

  // Return Public Funtions of this module
  return AuthData;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const AuthData = { // Public functions accessible by other modules

  /********************************************************************
  Return a Session-Data object

  @param {String} partition_id - Root Partition namespace for which this session is valid (App-ID, Organisation-ID, ...)
  @param {String} actor_id - ID of actor to whom this session belongs to
  @param {String} session_id - This Session's ID
  @param {Integer} platform_code - Auth Platform Code
  @param {String} site_id - Site ID for which this session is being created. Each instance of client app is new Site
  @param {Integer} time_of_creation - Time of Creation of this session (Unix Time)
  @param {Integer} time_of_expiry - Time of Expiration of this session (Unix Time)
  @param {Integer} time_of_last_accessed - Time when this session was last accessed (Unix Time)
  @param {String} client_name - Client
  @param {String} client_version - Client Version
  @param {Boolean} is_browser - Client Is Browser
  @param {Integer} screen_width - Client Screen Width
  @param {Integer} screen_height - Client Screen Height
  @param {String} os_name - Client OS
  @param {String} os_version - Client OS-Version
  @param {String} ip_address - Client IP-Address

  @return {Map} - Session Data Object in key-value
  *********************************************************************/
  createSessionData: function(
    partition_id, actor_id, session_id, platform_code, site_id,
    time_of_creation, time_of_expiry, time_of_last_accessed,
    client_name, client_version, is_browser,
    screen_width, screen_height,
    os_name, os_version, ip_address
  ){

    return {
      'partition_id'            : partition_id, // Partition-Id
      'actor_id'                : actor_id, // Owner of session
      'session_id'              : session_id, // Session ID
      'platform_code'           : platform_code, // Client app Platform-Code
      'site_id'                 : site_id, // Site on which this session is created
      'time_of_creation'        : time_of_creation, // Session Time of Creation
      'time_of_expiry'          : time_of_expiry, // Session Expirey
      'time_of_last_accessed'   : time_of_last_accessed, // Session Time of Last Accessed
      'client_name'             : client_name, // Client Name
      'client_version'          : client_version, // Client Version
      'is_browser'              : is_browser, // Client Is Browser
      'screen_width'            : screen_width, // Client Screen Width
      'screen_height'           : screen_height, // Client Screen Height
      'os_name'                 : os_name, // Client OS
      'os_version'              : os_version, // Client OS-Version
      'ip_address'              : ip_address, // Client IP-Address
    };

  },


  /********************************************************************
  Create Platform-Code from Platform Text

  @param {String} platform - text equivalent of platform-code

  @return {Integer} - Platform-Code
  *********************************************************************/
  createPlatformCode: function(platform){

    return CONFIG.APP_PLATFORMS[platform];

  },

};///////////////////////////Public Functions END///////////////////////////////



//////////////////////////Private Functions START///////////////////////////////
const _AuthInput = { // Private functions accessible within this modules only
  // None
};/////////////////////////Private Functions END////////////////////////////////
