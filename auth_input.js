// Info: Contains Functions Related to Auth Input Data Cleanup and Validations
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
  return AuthInput;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const AuthInput = { // Public functions accessible by other modules

  /********************************************************************
  Return cleaned Auth-ID for non-sql purposes
  Remove all the dangerous characters excluding those who satisfy RegExp

  @param {string} auth_id - Auth-ID to be cleaned

  @return - Sanitized string
  *********************************************************************/
  sanitizeAuthID: function(auth_id){

    // Clean and return
    return Lib.Utils.sanitizeUsingRegx(auth_id, CONFIG.AUTH_ID_SANATIZE_REGX);

  },


  /********************************************************************
  Check if pratform is in known list of App-Platforms

  @param {String} platform - App Platform (Fixed values)

  @return {Boolean} - true on success
  @return {Boolean} - false if validation fails
  *********************************************************************/
  validateAppPlatform: function(platform){

    if( !(platform in CONFIG.APP_PLATFORMS) ){
      return false;
    }


    // Reach here means all validations passed
    return true; // Validation successful

  }

};///////////////////////////Public Functions END///////////////////////////////



//////////////////////////Private Functions START///////////////////////////////
const _AuthInput = { // Private functions accessible within this modules only
  // None
};/////////////////////////Private Functions END////////////////////////////////
