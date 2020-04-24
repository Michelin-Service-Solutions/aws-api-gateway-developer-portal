const fetch = require('node-fetch');
const aws = require('aws-sdk');
const lambda = new aws.Lambda({ region: 'us-east-1'});


const replaceAll = function (originalStr, searchStr , replaceStr) {
  const str = originalStr;
  searchStr = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(searchStr, 'gi'), replaceStr);
};

// Get Call Uri Function: 
// Returns the real URI that we are going to call.
// For instance it converts event.uri:
// /users/{id} into /users/1

const getCallUri = function(pathParams, uri) {
  let callUri = uri;
  Object.keys(pathParams).forEach(function (pathParam, index) {
    const replaceValue = `{${pathParam}}`;
    const value = pathParams[pathParam];
    callUri = replaceAll(callUri, replaceValue, pathParams[pathParam]);
  });
  return callUri;
}

exports.handler = async (event,context,callback) => {
    let payload = JSON.stringify(event);
    let response = null;

    //return event
    // Before hooks
    try {
        for (var _i = 0; _i < event.hooksBefore.length; _i++) {
            response = await lambda.invoke({FunctionName: event.hooksBefore[_i],Payload:payload}).promise();
            payload = JSON.stringify({body: JSON.parse(response.Payload)});
        }
    } catch (err) {
        callback(err,null);
    }
    
    //call realAPI with response
    let callUri = getCallUri(event.pathParams, event.uri);
    const apiResponse = await fetch(callUri,{ method: event.method, body: payload, headers: event.headers });
    const json = await apiResponse.json();
    
    // after
    payload = json;
    response = payload;
    try {
        for (var _i = 0; _i < event.hooksAfter.length; _i++) {
            response = await lambda.invoke({FunctionName: event.hooksBefore[_i],Payload:payload}).promise();
            payload = JSON.stringify({body: JSON.parse(response.Payload)});
        }
    } catch (err) {
        callback(err,null);
    }
    return response.Payload ? response.Payload : response;
};
