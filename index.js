#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require("path");
const templates = require('./templates.js');
const compile = require('node-elm-compiler').compile;
const yargs = require('yargs');

const STDOUT_KEY = '::stdout';
const defaultViewFunction = "view";
var renderDirName = '.elm-static-html';

var argv = yargs
    .usage('Usage: <command> [options]')
    .version()
    .help('h')
    .alias('h', 'help')
    .alias('f', 'filename')
    .describe('f', 'Provide an Elm file to compile to HTML')

    .alias('o', 'output')
    .describe('o', 'Write to a particular file. Defaults to STDOUT')

    .alias('v', 'verbose')
    .describe('v', 'Be more chatty')
    .default('v', false)

    .alias('c', 'config')
    .describe('c', 'Provide a json file for use as config')

    .describe('init-config', 'Generate an example config.json')

    .argv;

var standardizedConfig = function(config){
    if (typeof config === "string"){
        return [{
            "output": config,
            "viewFunction": defaultViewFunction
        }];
    }

    // make 1-element array if the value is an array already
    if (config.constructor !== Array){
        config = [config];
    }

    // for every output/viewFunction pair check that they are valid
    config.map(function(configItem){
        var keys = Object.keys(configItem);
        if (keys.indexOf("output") === -1 || keys.indexOf('viewFunction') === -1){
            console.error('Malformed config!', configItem);
            console.log('It should have an output field and a viewFunction field!');
            return null;
        }
    });

    return config;
};

const isVerbose = argv.verbose;
const isInitConfig = (typeof argv.initConfig !== "undefined" && argv.initConfig);
const outputToStdOut = (typeof argv.o === "undefined");
const isUsingConfig = (typeof argv.c !== "undefined");

if (isInitConfig){
    if (isVerbose) console.log('Initializing elm-static-html.json..');
    fs.writeFileSync(
        path.join(process.cwd(), 'elm-static-html.json'),
        templates.generateConfig() + "\n"
    );
    if (isVerbose) console.log('Done!');

    return 0;
}


var config = null;

if (isUsingConfig){
    if (isVerbose) console.log('Using the config file', argv.config);
    try {
        config = require(path.join(process.cwd(), argv.config));

        Object.keys(config['files']).map(function(filename){
            var standardized = standardizedConfig(config['files'][filename]);
            config['files'][filename] = standardized;
        });

    } catch (e) {
        console.error('Failed to load config file! You can make an initial config through --init');
        console.error(e);
        return -1;
    }
} else {
    if (typeof argv.filename === "undefined") {
        yargs.showHelp();
        return -1;
    }

    if (isVerbose) console.log('Loading file.. ', argv.filename);
    if (isVerbose && outputToStdOut) console.log('Outputting to stdout..');
    var outputName = null;

    if (outputToStdOut) {
        outputName = STDOUT_KEY;
    } else {
        outputName = argv.output;
    }

    config = {
        files : {}
    };

    config.files[argv.filename] = [{
        'output': outputName,
        'viewFunction': defaultViewFunction
    }];
}



var getModuleNames = function(config) {
    const moduleNames = Object.keys(config.files).map(function(filename){
        // load the file and try to read the module name by spliting
        var fileContents = fs.readFileSync(filename, 'utf-8');
        var moduleName = fileContents.split('\n');
        if (moduleName.length === 0){
            console.error("File is empty");
            console.error('skipping ', filename)
            return null;
        }
        
        moduleName = moduleName[0].split(' ');
        if (moduleName.length < 2 && moduleName[0] !== "module") {
            console.error('Expected module name on first line of file!');
            console.error('found', moduleName.join(' '));
            return null;
        }

        moduleName = moduleName[1].trim();

        if (moduleName.length === 0){
            console.error('No module name provided!');
            console.error('skipping ', filename)
            return null;
        } else if (moduleName === 'PrivateMain'){
            console.error('You can\'t call your module PrivateMain! Please rename it.');
            return null;
        }

        return { filename: filename, moduleName: moduleName, outputsAndFuncs: config.files[filename]};
    }).filter(function(moduleName){
        return moduleName != null;
    });

    return moduleNames;
};

const moduleNames = getModuleNames(config);


// fix an elm package file so that it will work with our project
// and install our deps
var fixElmPackage = function(workingDir, elmPackage){
    //elmPackage['native-modules'] = true;
    var sources = elmPackage['source-directories'].map(function(dir){
        return path.join(workingDir, dir);
    });
    sources.push('.');

    elmPackage['source-directories'] = sources;
    elmPackage['dependencies']['direct']['ThinkAlexandria/elm-html-in-elm'] = '1.0.1';

    return elmPackage;
};

var elmPackage = null;

// try to load elm.json
try {
    elmPackage = require(path.join(process.cwd(), 'elm.json'));
} catch (e){
    console.error('Failed to load elm.json!');
    console.error('Make sure elm.json is in the current dir');
    return -1;
}

// grab the user/project string from the elm.json file
elmPackage = fixElmPackage(process.cwd(), elmPackage);
var dirPath = path.join(process.cwd(), renderDirName);

// make our cache dir
try{
    fs.mkdirSync(renderDirName);
    fs.mkdirSync(path.join(dirPath, 'Native'));
} catch (e) {
    // ignore this and try to continue anyway
}

var elmPackagePath = path.join(dirPath, 'elm.json');
var privateMainPath = path.join(dirPath, 'PrivateMain.elm');
var nativePath = path.join(dirPath, 'Native/Jsonify.js');

// write things so we can run elm make
fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

var rendererFileContents = templates.generateRendererFile(moduleNames);
fs.writeFileSync(privateMainPath, rendererFileContents);

// TODO replace the native file with a find and replace on the generated js
//var nativeString = templates.generateNativeModuleString(projectName);
//fs.writeFileSync(nativePath, nativeString);

if (isVerbose) console.log('wrote template files to..', renderDirName);

var options = {
    cwd: dirPath,
    output: 'emitter.js'
};


var compileProcess = compile(privateMainPath, options);


compileProcess.on('exit',
    function(exitCode){
        if (exitCode !== 0){
            console.log("Exited with the code", exitCode);
            return;
            //console.log('Trying to proceed anyway..');
        }
        var emitterFile = path.join(dirPath, 'emitter.js');
        // Find and replace our entry point
        var emitterFileContents = fs.readFileSync(emitterFile, 'utf-8');
        var fixedEmitterContents = emitterFileContents.replace(/'REPLACE_ME_WITH_JSON_STRINGIFY'/g, 'JSON.stringify(x)');

        // Disable the XSS protections provided by Elm runtime. We are
        // generating static files from trusted content.
        fixedEmitterContents = fixedEmitterContents.replace(/function _VirtualDom_noScript\(/g,
            'function _VirtualDom_noScript(tag) { return tag }\nfunction _DISABLED_VirtualDom_noScript(');

        fixedEmitterContents = fixedEmitterContents.replace(/function _VirtualDom_noOnOrFormAction\(/g,
            'function _VirtualDom_noOnOrFormAction(key) { return key }\nfunction _DISABLED_VirtualDom_noOnOrFormAction(');

        fixedEmitterContents = fixedEmitterContents.replace(/function _VirtualDom_noInnerHtmlOrFormAction\(/g,
            'function _VirtualDom_noInnerHtmlOrFormAction(key) { return key }\nfunction _DISABLED_VirtualDom_noInnerHtmlOrFormAction(');

        fixedEmitterContents = fixedEmitterContents.replace(/function _VirtualDom_noJavaScriptUri\(/g,
            'function _VirtualDom_noJavaScriptUri(value) { return value }\nfunction _DISABLED_VirtualDom_noJavaScriptUri(');

        fixedEmitterContents = fixedEmitterContents.replace(/function _VirtualDom_noJavaScriptOrHtmlUri\(/g,
            'function _VirtualDom_noJavaScriptOrHtmlUri(value) { return value }\nfunction _DISABLED_VirtualDom_noJavaScriptOrHtmlUri(');
        
        fs.writeFileSync(emitterFile, fixedEmitterContents);

        var emitter = require(emitterFile);
        var worker = emitter.Elm.PrivateMain.init(null);
        worker.ports.htmlOut.subscribe(function(htmlOutput){

            htmlOutput.map(function(group){
                var outputFile = group[0];
                var html = group[1];

                if (outputFile === STDOUT_KEY){
                    if (isVerbose) console.log('Generated the following strings..');
                    console.log(html + "\n");
                } else {
                    if (isVerbose) console.log('Saving to', outputFile);
                    fs.writeFileSync(outputFile, html + "\n");
                }

                if (isVerbose) console.log('Done!');

            })

        });
    }
);
