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

async function createMethods(dataApi, resourceId, methods, uri) {
    for (let index = 0; index < methods.length; index++) {
        const method = methods[index][0].toUpperCase();

        const params = {
            restApiId: dataApi,
            resourceId: resourceId,
            httpMethod: method,
            authorizationType: 'NONE'
        };

        console.log(`-- ${method}`);
        
        await apigateway.putMethod(params).promise();

        //put-method --rest-api-id vh5shnoi47 --resource-id 2vw3hk --http-method ANY --authorization-type "NONE"
        await createIntegrationProxy(dataApi, resourceId, method, uri);

    }
}

async function createIntegrationProxy(dataApi, resourceId, method, uri) {

    const params = {
        restApiId: dataApi,
        resourceId: resourceId,
        httpMethod: method,
        integrationHttpMethod: method,
        type: "HTTP_PROXY",
        uri: uri
    };

    //--rest-api-id vh5shnoi47  --resource-id 2vw3hk --http-method ANY --integration-http-method ANY --type HTTP_PROXY --uri https://api.integration.misp-solutions.com
    await apigateway.putIntegration(params).promise();
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


async function createAPI(name) {

    var { id } = await apigateway.createRestApi({ name }).promise();
    var apiResources = await apigateway.getResources({restApiId: id}).promise();
    const rootPathId = apiResources.items[0].id;

    return {apiId: id, rootPathId };
}

exports.post = async (req, res) => {
    const apiName = req.body.apiName;
    const jsonSpec = req.body.jsonSpec;
    const host = req.body.host;

    // First create the API in Api Gateway
    const { apiId, rootPathId } = await createAPI(apiName);

    const jsonPaths = jsonSpec.paths;
    const paths = objToarray(jsonPaths || {});
    const names = pluck(paths, 0).sort();
    for (let index = 0; index < names.length; index++) {
        const path = names[index]
        console.log('creating resources for: ' + path); 
        await createResources(apiId, rootPathId, path, host, jsonPaths[path]);
    }
    res.status(200).send({
        success: true,
        apiId
    })
}