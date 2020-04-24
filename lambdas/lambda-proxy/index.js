const fetch = require('node-fetch');
const aws = require('aws-sdk');
const lambda = new aws.Lambda({ region: 'us-east-1'});

exports.handler = async (event,context,callback) => {
    let payload = JSON.stringify(event);
    let response = null;
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
    const apiResponse = await fetch(event.uri,{ method: event.method, body: payload, headers: event.headers });
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
