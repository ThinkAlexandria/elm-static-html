// literally the only reason why this has to be an npm package
var generateNativeModuleString = function(projectName){
    var fixedProjectName = projectName.replace(/-/g, '_');

    var nativeString = `
var _${fixedProjectName}$Native_Jsonify = {
    stringify: function(thing) { return JSON.stringify(thing); }
};`;

    return nativeString;
};


var importLines = function(moduleNames){
    return moduleNames.map(function(moduleConfig){
        return `import ${moduleConfig.moduleName}`;
    });
};

var viewFunctions = function(moduleNames){
    var pairs = moduleNames.map(function(moduleConfig){
            return moduleConfig.outputsAndFuncs.map(function(outputConfig){
                return `("${outputConfig.output}", ${moduleConfig.moduleName}.${outputConfig.viewFunction})`;
            });
        });
    return [].concat.apply([], pairs);
};

// this is our render's file contents
// basically just boilerplate
var generateRendererFile = function(moduleNames, insertNewLines) {
    var imports = importLines(moduleNames).join("\n");
    var views = viewFunctions(moduleNames).join(", ");

    var newLines = "False";
    if (insertNewLines) {
        newLines = "True";
    }
    var indent = "4";

    var rendererFileContents = `
port module PrivateMain exposing (..)

import Platform
import Html exposing (Html)
import ElmHtml.InternalTypes exposing (decodeElmHtml)
import ElmHtml.ToString exposing (nodeToStringWithOptions, defaultFormatOptions)
import Json.Decode as Json

${imports}


asJsonString : Html msg -> String
asJsonString x = "REPLACE_ME_WITH_JSON_STRINGIFY"

options = { defaultFormatOptions | newLines = ${newLines}, indent = ${indent} }

decode : (String, Html msg) -> ( String, String )
decode (output, view) =
    case Json.decodeString (decodeElmHtml (\\_ \_ -> Json.succeed ())) (asJsonString view) of
        Err err -> (output, Json.errorToString err)
        Ok str -> (output, nodeToStringWithOptions options str)

main = Platform.worker
    { init =
        (\\ () ->
            ( ()
            , htmlOut ( List.map (decode ) [ ${views} ] )
            )
        )
    , update = (\\_ b -> (b, Cmd.none))
    , subscriptions = (\\_ -> Sub.none)
    }

port htmlOut : List (String, String) -> Cmd msg
`;
    return rendererFileContents;
};


var generateConfig = function() {
    var config = {
        files: {
            "Main.elm": {
                output: "index.html",
                viewFunction: "view"
            }
        }
    };
    return JSON.stringify(config, undefined, 4);
};


module.exports = {
    generateRendererFile: generateRendererFile,
    generateNativeModuleString: generateNativeModuleString,
    generateConfig: generateConfig
};
