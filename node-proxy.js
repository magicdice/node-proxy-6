//------------------------------------------------------------------------------------------
// NodeJS proxy script
// See all sections marked CUSTOMISE: for things you will need to customise
(function () {
    var http = require('http'),
        httpProxy = require('http-proxy'),
        fs = require('fs'),
        util = require('util');

    // CUSTOMISE: prefix for location of local file - adjust to your requirements
    var WEB_ROOT = "C:/dev/myproject";

    // CUSTOMISE: define the list of mappings: what URI regex matches to what file on the filesystem
    var PROXY_MAP = {
        "FileName.js": {
            regex: /.*?FileName[.]min[.]js.*/,       // regex that specifies what to match on the URI
            replaceWithFile: WEB_ROOT + "/Pages/JS/FileName.js",      // location of local file to replace
            headers: {
                'Content-Type': "text/js"               // http headers to return
            }
        }
        ,
        "FileName.css": {
            regex: /.*?FileName[.]css.*/,
            replaceWithFile: WEB_ROOT + "/Pages/CSS/FileName.css",
            headers: {
                'Content-Type': "text/css"
            }
        }
        ,
        "FileName.svc/ServiceName": {
            regex: /FileName.svc\/ServiceName/,
            headers: {
                'Content-Type': "application/json; charset=utf-8"
            },
            generateJsonResponse: function (postVars) {
                var response = {"this": "that"};

                return JSON.stringify(response);
            }
        }
    };

    // CUSTOMISE: proxy configurations
    // NOTE: if more than one configuration is listening on the same port, a runtime error will result
    var PROXY_CONFIGS = {
        "myHost1": {
            ipAddress: '192.168.1.100',
            port: 26222,
            proxyMap: PROXY_MAP
        }
        ,
        "myHost2": {
            ipAddress: '192.168.1.101',
            port: 26222,
            proxyMap: PROXY_MAP
        }
    };

    // send a JSON object
    function serveJson(response, json, headers) {
        response.writeHead(200, headers);
        response.write(json);
        response.end();
    }

    // Serve up a file from the filesystem
    function serveFile(response, file, headers) {
        fs.exists(file, function (exists) {
            if (!exists) {
                console.error('File does not exist: ', file);
                response.send('oops! 404: ' + file, 404);
            }

            // source: http://stackoverflow.com/questions/10046039/nodejs-send-file-in-response
            var stat = fs.statSync(file);

            headers['Content-Length'] = stat.size;
            response.writeHead(200, headers);
            var readStream = fs.createReadStream(file);
            util.pump(readStream, response);

            console.log("LOCAL:", file);
            console.log(headers);
        });
    }

    console.log("----------------------------------------------------");
    for (var proxyName in PROXY_CONFIGS) {
        var proxyConfig = PROXY_CONFIGS[proxyName];
        var ipAddress = proxyConfig.ipAddress;
        var port = proxyConfig.port;
        var proxyMap = proxyConfig.proxyMap;
        var httpServer = http.createServer();

        httpServer.on('request', function (request, response) {
            var proxy = new httpProxy.HttpProxy({
                target: {
                    host: ipAddress,
                    port: port
                },
                changeOrigin: false
            });

            console.log(" ");

            // loop through all the mappings to see if we need to serve a local file
            for (var mapKey in proxyMap) {
                var mapping = proxyMap[mapKey];
                var regex = mapping["regex"];
                var headers = mapping["headers"];

                if (request.url.match(regex)) {
                    var replaceWithFile = mapping["replaceWithFile"];
                    var generateJsonResponse = mapping["generateJsonResponse"];

                    if (replaceWithFile) {
                        serveFile(response, replaceWithFile, headers);
                    } else if (generateJsonResponse) {
                        request.on('data', function (dataChunk) {
                            var dataChunkAsJson = eval("(" + dataChunk.toString() + ")").pricingRequest;
                            serveJson(response, generateJsonResponse(dataChunkAsJson), headers);
                        });
                    }

                    return;
                }
            }

            // if we reach here, there was no match, so pass the request on to the proxy
            console.log(request.method, request.headers.host, request.url.substring(0, 120), "...");
            proxy.proxyRequest(request, response);
        });

        httpServer.listen(port);

        console.log("Server running:", proxyName, ipAddress, port);
        for (var mapKey in proxyMap) {
            var mapping = proxyMap[mapKey];
            console.log("  ", mapKey, "=>", (mapping.replaceWithFile ? mapping.replaceWithFile : mapping.generateJsonResponse));
        }
    }

    console.log(" ");

}());

// EOF
//------------------------------------------------------------------------------------------
