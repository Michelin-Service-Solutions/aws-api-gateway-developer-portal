const axios = require('axios');
const aws = require('aws-sdk');
const lambda = new aws.Lambda({ region: 'us-east-1'});
const { URL, URLSearchParams } = require('url');
const https = require('https');
const httpsAgent = new https.Agent({
     rejectUnauthorized: false,
});
    
const replaceAll = function (originalStr, searchStr , replaceStr) {
  const str = originalStr;
  searchStr = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(searchStr, 'gi'), replaceStr);
};

// Get Call Uri Function: 
// Returns the real URI that we are going to call.
// For instance it converts event.uri:
// /users/{id} into /users/1

const replacePathParams = function(pathParams, uri) {
  let callUri = uri;
  Object.keys(pathParams).forEach(function (pathParam, index) {
    const replaceValue = `{${pathParam}}`;
    const value = pathParams[pathParam];
    callUri = replaceAll(callUri, replaceValue, pathParams[pathParam]);
  });
  return callUri;
}

const appendQueryParams = function(uri, queryParams) {
    let finalUri = new URL(uri);
    finalUri.search = new URLSearchParams(queryParams).toString();
    return finalUri.toString();
}

const callApi = async function (uri, pathParams, method, bodyPayload, queryParams, headers) {
    const body = (method === "GET" || method === "HEAD") ?  null : bodyPayload;
    let finalUri = replacePathParams(pathParams, uri);
    finalUri = appendQueryParams(finalUri, queryParams);
    let response = {};
    try {
       response = await axios({
            method,
            url: finalUri,
            headers,
            data: body,
            httpsAgent
        }); 
    } catch(error) {
        // This is because Axios by default throws an ERROR on 3xx, 4xx and 5xx responses
        // We dont want that. We want the full response and then let API Gateway handle
        // the errors.
        response = error.response;
    }
   
    return {
        status: response.status,
        headers: response.headers,
        body: response.data
    }
}

exports.handler = async (event,context,callback) => {
    let payload = JSON.stringify(event);
    let response = null;
    
    // Before hooks.
    // Hooks will receive a JSON string in the payload (flat)
    // And they have to return same format within response.Payload.
    try {
        for (var _i = 0; _i < event.hooksBefore.length; _i++) {
            response = await lambda.invoke({FunctionName: event.hooksBefore[_i],Payload:payload}).promise();
            payload = response.Payload;
        }
    } catch (err) {
        callback(err,null);
    }
    
    const updatedEvent = JSON.parse(payload); // This is the outputs of the hooks, or it is equal event if hooks is empty

    //call realAPI with response
    const apiResponse = await callApi(
        updatedEvent.uri, 
        updatedEvent.pathParams, 
        updatedEvent.method, 
        updatedEvent.body, 
        updatedEvent.queryParams, 
        updatedEvent.headers
    );
    
    // After HOOKS
    // They must know how to process AXIOS responses in their payload, i.e { status, headers, body }
    // and they must return the same format.
    payload = JSON.stringify(apiResponse);
    response = apiResponse;

    try {
        for (var _i = 0; _i < event.hooksAfter.length; _i++) {
            response = await lambda.invoke({FunctionName: event.hooksBefore[_i],Payload:payload}).promise();
            payload = response.Payload;
        }
    } catch (err) {
        callback(err,null);
    }
    
    return response.Payload ? JSON.parse(response.Payload) : response;
};
