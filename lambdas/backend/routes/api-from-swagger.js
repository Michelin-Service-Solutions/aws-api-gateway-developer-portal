'use strict'

const { apigateway } = require('../util');

function objToarray(json_data) {
    const arr = Object.keys(json_data).map((key) =>
        [key, json_data[key]]
    );

    return arr;
}

async function createResourcePath(dataApi, parentId, fullpath) {
    //not empty
    if (fullpath.length > 0) {

        const params = {
            restApiId: dataApi,
            parentId: parentId,
            pathPart: fullpath[0]
        };

        var resourceId = await existResource(dataApi, parentId, fullpath[0]);

        if (resourceId) {
            return await createResourcePath(dataApi, resourceId, fullpath.slice(1))
        } else {
            // We have to create the resource
            var data = await apigateway.createResource(params).promise();
            return await createResourcePath(dataApi, data.id, fullpath.slice(1))
        }
    }

    return parentId;
}

function createRequestParameters(method) {
    console.log('METHOD OBJECT ', method);
    if (!method.parameters || method.parameters.length === 0) return {};
    let requestParameters = {};

    method.parameters.forEach(param => {
        const paramType = param.in === 'query' ? 'querystring' :
        param.in === 'path' ? 'path' : 'header';
        const isRequired = !!param.required;
        requestParameters[`method.request.${paramType}.${param.name}`] = isRequired;
    });
    return requestParameters;
}

async function createMethods(dataApi, resourceId, methods, uri) {
    for (let index = 0; index < methods.length; index++) {
        const method = methods[index][0].toUpperCase();
        const methodObject = methods[index][1];
        const params = {
            restApiId: dataApi,
            resourceId: resourceId,
            httpMethod: method,
            authorizationType: 'NONE',
            requestParameters: createRequestParameters(methodObject)
        };

        console.log(`-- ${method}`);
        
        await apigateway.putMethod(params).promise();

        //put-method --rest-api-id vh5shnoi47 --resource-id 2vw3hk --http-method ANY --authorization-type "NONE"
        await createIntegrationProxy(dataApi, resourceId, method, uri);

    }
}

async function createIntegrationProxy(dataApi, resourceId, method, uri) {
    const lambdaFunction = 'arn:aws:lambda:us-east-1:540573004174:function:dev-portal-lambda-proxy';
    const params = {
        restApiId: dataApi,
        resourceId: resourceId,
        httpMethod: method,
        integrationHttpMethod: 'POST',
        type: "AWS",
        uri: `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${lambdaFunction}/invocations`,
        requestTemplates: {
            'application/json' : 
                ` { "body" : $input.json('$'),
                "method": "$context.httpMethod",
                "headers": {
                    #foreach($param in $input.params().header.keySet())
                    "$param": "$util.escapeJavaScript($input.params().header.get($param))" #if($foreach.hasNext),#end
                    #end  
                },
                "hooksBefore": [],
                "hooksAfter": [],
                "uri": "${uri}" }
                `
        },
        credentials: 'arn:aws:iam::540573004174:role/dev-portal-lamdba-execution'
    };

    //--rest-api-id vh5shnoi47  --resource-id 2vw3hk --http-method ANY --integration-http-method ANY --type HTTP_PROXY --uri https://api.integration.misp-solutions.com
    await apigateway.putIntegration(params).promise();

    // Add 200 response 
    const responseParams = {
        restApiId: dataApi,
        resourceId: resourceId,
        httpMethod: method,
        statusCode: '200'
    }
    await apigateway.putMethodResponse(responseParams).promise();
    await apigateway.putIntegrationResponse(responseParams).promise();
}


async function createResources(apiId, rootPathId, fullpath, baseUri, methods) {
    // ['/pet/coco',{put,get,etc}]

    var resourceId = await createResourcePath(apiId, rootPathId, fullpath.split('/').slice(1));

    console.log('Creating method for path :'+fullpath);
    //     //methods= [ put,get]
    await createMethods(apiId, resourceId, objToarray(methods), baseUri + fullpath);

    return true;
}

async function existResource(dataApi, parentId, name) {

    const params = {restApiId: dataApi};

    var data = await apigateway.getResources(params).promise();

    for (let index = 0; index < data.items.length; index++) {
        const item=data.items[index];
        if (item.pathPart === name && item.parentId === parentId) {
            return item.id;
        }
    }

    return false;
}

function pluck(array, key) {
    return array.map(o => o[key]);
}

async function deployEnvironment(apiId, environment, host) {
    const params = {
        restApiId: apiId,
        stageName: environment,
        variables: {
            host
        }
    }
    await apigateway.createDeployment(params).promise();
}

async function createAPI(name) {

    var { id } = await apigateway.createRestApi({ name }).promise();
    var apiResources = await apigateway.getResources({restApiId: id}).promise();
    const rootPathId = apiResources.items[0].id;

    return {apiId: id, rootPathId };
}

exports.post = async (req, res) => {
    const apiName = req.body.apiName;
    const jsonSpec = req.body.jsonSpec;
    const baseUri = req.body.host;
    const environment = req.body.environment;

    // First create the API in Api Gateway
    const { apiId, rootPathId } = await createAPI(apiName);

    // Then create all its resources
    try {
        const jsonPaths = jsonSpec.paths;
        const paths = objToarray(jsonPaths || {});
        const names = pluck(paths, 0).sort();
        for (let index = 0; index < names.length; index++) {
            const path = names[index]
            console.log('creating resources for: ' + path); 
            await createResources(apiId, rootPathId, path, baseUri, jsonPaths[path]);
        }
        // Then deploy the environment
        if (environment) {
            await deployEnvironment(apiId, environment, baseUri);
        }
    } catch(e) {
        // If something failed lets delete the API
        await apigateway.deleteRestApi({ restApiId: apiId }).promise();
        throw (e); // This error will be catched by the wrapError function
    }   

    res.status(200).send({
        success: true,
        apiId
    })
}