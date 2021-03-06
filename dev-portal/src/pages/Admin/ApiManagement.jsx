import React from 'react'

import { Button, Loader, Table, Modal, Form, Message, Popup, Icon, Dropdown, Input, TextArea } from 'semantic-ui-react'

import { apiGatewayClient } from 'services/api'
import { getApi } from 'services/api-catalog'
import { store } from 'services/state'

import * as YAML from 'yamljs'

import hash from 'object-hash'
import { toJS } from 'mobx'
import { observer } from 'mobx-react'

function getUsagePlanVisibility(usagePlan) {
  let hasHidden = false
  let hasVisible = false

  for (const api of usagePlan.apis) {
    if (api.visibility) {
      if (hasHidden) return null
      hasVisible = true
    } else {
      if (hasVisible) return null
      hasHidden = true
    }
  }

  return hasVisible
}

const defaultMappingTemplate = `{ 
  "body" : $input.json('$'),
  "method": "$context.httpMethod",
  "headers": {
      #foreach($param in $input.params().header.keySet())
      "$param": "$util.escapeJavaScript($input.params().header.get($param))" #if($foreach.hasNext),#end
      #end  
  },
  "pathParams": {
      #foreach($param in $input.params().path.keySet())
      "$param": "$util.escapeJavaScript($input.params().path.get($param))" #if($foreach.hasNext),#end
      #end
  },
  "queryParams": {
      #foreach($queryParam in $input.params().querystring.keySet())
      "$queryParam": "$util.escapeJavaScript($input.params().querystring.get($queryParam))" #if($foreach.hasNext),#end
    #end
  },
  "hooksBefore": [],
  "hooksAfter": [],
  "uri": {{DO_NOT_REPLACE}}
}
`


export const ApiManagement = observer(class ApiManagement extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      modalOpen: false,
      newApiModalOpen: false,
      errors: [],
      apisUpdating: [],
      apiSelected: '',
      apiHost: '',
      apiName: '',
      apiEnv: '',
      apiMappingTemplate: defaultMappingTemplate,
      loadingFile: false,
      fileErrors: false,
      errorMessage: '',
      swaggerFile: {},
    }

    this.fileInput = React.createRef()
    this.newAPIFileInput = React.createRef()

    this.tableSort = (first, second) => {
      if (first.name !== second.name) {
        return first.name.localeCompare(second.name)
      } else {
        return first.stage.localeCompare(second.stage)
      }
    }

    this.genericTableSort = (firstIndex, secondIndex) => {
      const list = store.visibility.generic

      if (list[firstIndex].name !== list[secondIndex].name) {
        list[firstIndex].name.localeCompare(list[secondIndex].name)
      } else {
        // compare by their index, which happens to be their id
        return firstIndex.localeCompare(secondIndex)
      }
    }

    this.usagePlanSort = (first, second) => {
      if (first.name !== second.name) {
        return first.name.localeCompare(second.name)
      } else {
        return first.id.localeCompare(second.id)
      }
    }
  }

  componentDidMount() {
    this.getApiVisibility()
  }

  // This methods create a new API Gateway API
  uploadNewAPIFile(event) {
    event.preventDefault()
    const files = this.newAPIFileInput.current.inputRef.current.files
    //this.newAPIFileInput = null;
    let swagger, swaggerObject, anyFailures

    this.setState(prev => ({ ...prev, loadingFile: true }))
    if (files.length > 0) {
      this.setState(prev => ({ ...prev, errors: [] }))
        ;[].forEach.call(files, file => {

          const reader = new window.FileReader()

          reader.onload = (e) => {
            try {
              if (file.name.includes('yaml')) {
                swaggerObject = YAML.parse(e.target.result)
                swagger = JSON.stringify(swaggerObject)
              } else {
                swaggerObject = JSON.parse(e.target.result)
                swagger = JSON.stringify(swaggerObject)
              }
            } catch (e) {
              this.setState({
                fileErrors: true,
                errorMessage: 'Invalid JSON file',
                loadingFile: false
              })
              return
            }


            const host = swaggerObject.basePath ? swaggerObject.host + swaggerObject.basePath : swaggerObject.host
            this.setState(prev => ({
              ...prev,
              apiHost: host,
              apiName: swaggerObject.info.title,
              loadingFile: false,
              swaggerFile: swaggerObject,
            }))

          }
          reader.readAsText(file)
        })
    }
  }

  createAPIGatewayAPI() {
    const { swaggerFile, apiName, apiHost, apiEnv, apiMappingTemplate } = this.state
    apiGatewayClient()
      .then((app) => app.post('/api-from-swagger', {}, {
        jsonSpec: swaggerFile,
        apiName,
        host: apiHost,
        environment: apiEnv,
        mappingTemplate: apiMappingTemplate
      }, {}))
      .then((res) => {
        if (res.status === 200) {
          console.log('API Created')
        } else {
          console.log(res.status)
          console.log(res.data.message)
        }
        this.closeApiModal()
      }).catch((e) => {
        this.setState(prev => ({
          ...prev,
          fileErrors: true,
          errorMessage: e.data.message
        }))
        console.log(e.status)
        console.log(e.data)
      })
  }

  // This method upload a API specification to S3
  uploadAPISpec(event) {
    event.preventDefault()
    console.log(this.fileInput.current.files)
    const files = this.fileInput.current.files
    let swagger, swaggerObject, anyFailures

    if (files.length > 0) {
      this.setState(prev => ({ ...prev, errors: [] }))
        ;[].forEach.call(files, file => {
          const reader = new window.FileReader()

          reader.onload = (e) => {
            if (file.name.includes('yaml')) {
              swaggerObject = YAML.parse(e.target.result)
              swagger = JSON.stringify(swaggerObject)
            } else {
              swaggerObject = JSON.parse(e.target.result)
              swagger = JSON.stringify(swaggerObject)
            }

            if (!(swaggerObject.info && swaggerObject.info.title)) {
              anyFailures = true
              this.setState(prev => ({ ...prev, errors: [...prev.errors, file.name] }))
              return
            }

            if (anyFailures) {
              return
            }
            const { apiSelected } = this.state;

            apiGatewayClient()
              .then((app) => app.post('/admin/catalog/visibility', {}, { swagger, apiSelected }, {}))
              .then((res) => {
                if (res.status === 200) {
                  this.setState(prev => ({
                    ...prev,
                    modalOpen: Boolean(anyFailures),
                    errors: anyFailures ? prev.errors : []
                  }))
                }
                setTimeout(() => this.getApiVisibility(), 2000)
              })
          }
          reader.readAsText(file)
        })
    }
  }

  closeApiModal() {
    this.setState({
      newApiModalOpen: false,
      fileErrors: false,
      loadingFile: false,
      apiHost: '',
      apiName: '',
      apiEnv: '',
      swaggerFile: {},
      apiMappingTemplate: defaultMappingTemplate,
    })
  }

  deleteAPISpec(apiId) {
    getApi(apiId, false, undefined, true).then(api => {
      const _api = toJS(api)
      const myHash = hash(_api.swagger)

      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/generic/${myHash}`, {}, {}, {}))
        .then((res) => {
          setTimeout(() => this.getApiVisibility(), 2000)
        })
    })
  }

  getApiVisibility() {
    apiGatewayClient()
      .then(app => app.get('/admin/catalog/visibility', {}, {}, {}))
      .then(res => {
        if (res.status === 200) {
          // console.log(`visibility: ${JSON.stringify(res.data, null, 2)}`)

          const apiGateway = res.data.apiGateway
          const generic = res.data.generic && Object.keys(res.data.generic)

          // console.log(`generic: ${JSON.stringify(generic, null, 2)}`)
          // console.log(`api gateway: ${JSON.stringify(apiGateway, null, 2)}`)

          apiGateway.forEach(api => {
            if (generic) {
              generic.forEach(genApi => {
                if (res.data.generic[`${genApi}`]) {
                  if (
                    res.data.generic[`${genApi}`].apiId === api.id &&
                    res.data.generic[`${genApi}`].stage === api.stage
                  ) {
                    api.visibility = true
                    delete res.data.generic[`${genApi}`]
                  }
                }
              })
            }
          })

          store.visibility = res.data
        }
      })
  }

  updateLocalApiGatewayApis(apisList, updatedApi, parity) {
    const updatedApis = apisList.map(stateApi => {
      if (stateApi.id === updatedApi.id && stateApi.stage === updatedApi.stage) {
        if (parity !== undefined && (parity === true || parity === false)) {
          stateApi.visibility = parity
        } else {
          stateApi.visibility = !stateApi.visibility
        }
      }
      return stateApi
    })

    store.visibility = { generic: store.visibility.generic, apiGateway: updatedApis }
  }

  showApiGatewayApi(api) {
    apiGatewayClient()
      .then(app => app.post('/admin/catalog/visibility', {}, { apiKey: `${api.id}_${api.stage}`, subscribable: `${api.subscribable}` }, {}))
      .then((res) => {
        if (res.status === 200) {
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, api)
        }
      })
  }

  hideApiGatewayApi(api) {
    if (!api.subscribable && !api.id && !api.stage) {
      this.deleteAPISpec(api.genericId)
    } else {
      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/${api.id}_${api.stage}`, {}, {}, {}))
        .then((res) => {
          if (res.status === 200) {
            this.updateLocalApiGatewayApis(store.visibility.apiGateway, api)
          }
        })
    }
  }

  showAllApiGatewayApis(usagePlan) {
    Promise.all(usagePlan.apis.map((api) =>
      apiGatewayClient()
        .then(app => app.post('/admin/catalog/visibility', {}, {
          apiKey: `${api.id}_${api.stage}`,
          subscribable: `${api.subscribable}`
        }, {}))
        .then(res => { res.api = api; return res })
    )).then((promises) => {
      promises.forEach((result) => {
        if (result.status === 200) {
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, result.api, true)
        }
      })
    })
  }

  hideAllApiGatewayApis(usagePlan) {
    Promise.all(usagePlan.apis.map((api) =>
      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/${api.id}_${api.stage}`, {}, {}, {}))
        .then(res => { res.api = api; return res })
    )).then((promises) => {
      promises.forEach((result) => {
        if (result.status === 200) {
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, result.api, false)
        }
      })
    })
  }

  isUpdatingApiGatewayApi(api) {
    return this.state.apisUpdating.includes(`${api.id}_${api.stage}`)
  }

  updateApiGatewayApi(api) {
    // Simpler than implementing a multiset, and probably also faster.
    this.setState(({ apisUpdating }) => ({
      apisUpdating: [...apisUpdating, `${api.id}_${api.stage}`]
    }))
    apiGatewayClient()
      .then(app => app.post('/admin/catalog/visibility', {}, { apiKey: `${api.id}_${api.stage}`, subscribable: `${api.subscribable}` }, {}))
      .then(() => this.setState(({ apisUpdating }) => {
        const index = apisUpdating.indexOf(`${api.id}_${api.stage}`)
        const newApisUpdating = apisUpdating.slice()
        newApisUpdating.splice(index, 1)
        return { apisUpdating: newApisUpdating }
      }))
  }

  isSdkGenerationConfigurable(api) {
    return api.visibility
  }

  toggleSdkGeneration(apisList, updatedApi) {
    apiGatewayClient()
      .then(app => {
        if (updatedApi.sdkGeneration) {
          return app.delete(`/admin/catalog/${updatedApi.id}_${updatedApi.stage}/sdkGeneration`, {}, {}, {})
        } else {
          return app.put(`/admin/catalog/${updatedApi.id}_${updatedApi.stage}/sdkGeneration`, {}, {}, {})
        }
      })
      .then(res => {
        if (res.status === 200) {
          const updatedApis = apisList.map(stateApi => {
            if (stateApi.id === updatedApi.id && stateApi.stage === updatedApi.stage) {
              stateApi.sdkGeneration = !stateApi.sdkGeneration
            }
            return stateApi
          })

          store.visibility.apiGateway = updatedApis
        }
      })
  }

  renderHeaderVisibilityButton(usagePlan) {
    const usagePlanVisibility = getUsagePlanVisibility(usagePlan)

    // Some APIs are visible, some are hidden. Show the current state (Partial, with a warning) and enable all on click
    if (usagePlanVisibility == null) {
      return (
        <Popup
          content='Users subscribed to any of the APIs in this usage plan will have a valid API key for all APIs in this usage plan, even those that are not visible!'
          trigger={
            <Button
              basic
              color='yellow'
              style={{ backgroundColor: 'white', width: '100%', paddingLeft: '1em', paddingRight: '1em', minWidth: '88px' }}
              onClick={() => this.showAllApiGatewayApis(usagePlan)}
            >
              Partial <Icon name='warning sign' style={{ paddingLeft: '5px' }} />
            </Button>
          }
        />
      )
    }

    // Either all APIs are visible or none are visible. Toggle this state on click.
    return (
      <Button
        basic
        color={usagePlanVisibility ? 'green' : 'red'}
        style={{ backgroundColor: 'white', width: '100%' }}
        onClick={() => {
          if (usagePlanVisibility) this.hideAllApiGatewayApis(usagePlan)
          else this.showAllApiGatewayApis(usagePlan)
        }}
      >
        {usagePlanVisibility ? 'True' : 'False'}
      </Button>
    )
  }

  sortByUsagePlan() {
    if (!store.visibility.apiGateway) { return this.renderNoApis() }

    const usagePlans =
      store.visibility.apiGateway
        .filter((api) => api.usagePlanId)
        .reduce((accumulator, api) => {
          if (!accumulator.find((usagePlan) => api.usagePlanId === usagePlan.id)) {
            accumulator.push({ id: api.usagePlanId, name: api.usagePlanName })
          }
          return accumulator
        }, [])
        .sort(this.usagePlanSort)
        .map((usagePlan) => {
          return { ...usagePlan, apis: store.visibility.apiGateway.filter((api) => api.usagePlanId === usagePlan.id).sort(this.tableSort) }
        })
    const unsubscribable =
      store.visibility.apiGateway
        .filter((api) => !api.usagePlanId)
        .sort(this.tableSort)

    return (
      <>
        {usagePlans.map(usagePlan => {
          return (
            <>
              {this.renderHeader(usagePlan)}
              {this.renderApiList(usagePlan.apis)}
            </>
          )
        })}
        <Table.Row style={{ backgroundColor: '#1678c2', color: 'white' }}>
          <Table.Cell colSpan='6'>
            <b>Not Subscribable</b> <i>No Usage Plan</i>
          </Table.Cell>
        </Table.Row>
        {this.renderApiList(unsubscribable)}
      </>
    )
  }

  renderNoApis() {
    return (
      <Table.Row>
        <Table.Cell colSpan='4'>
          No APIs found
        </Table.Cell>
      </Table.Row>
    )
  }

  renderHeader(usagePlan) {
    return (
      <Table.Row style={{ backgroundColor: '#1678c2', color: 'white' }}>
        <Table.Cell colSpan='3'>
          <b>{usagePlan && usagePlan.name}</b> <i>Usage Plan</i>
        </Table.Cell>
        <Table.Cell>
          {this.renderHeaderVisibilityButton(usagePlan)}
        </Table.Cell>
        <Table.Cell colSpan='2'>
          {/* Intentionally empty */}
        </Table.Cell>
      </Table.Row>
    )
  }

  renderApiList(apis) {
    return <>
      {apis.filter(api => api.id !== window.config.restApiId).map(api => (
        <React.Fragment key={api.stage ? `${api.id}_${api.stage}` : api.id}>
          <Table.Row>
            <Table.Cell collapsing>{api.name}</Table.Cell>
            <Table.Cell>{api.stage}</Table.Cell>
            <Table.Cell>{api.subscribable ? 'Subscribable' : 'Not Subscribable'}</Table.Cell>
            <Table.Cell>
              <Button
                basic
                color={api.visibility ? 'green' : 'red'}
                style={{ width: '100%' }}
                onClick={() => api.visibility ? this.hideApiGatewayApi(api) : this.showApiGatewayApi(api)}
              >
                {api.visibility ? 'True' : 'False'}
              </Button>
            </Table.Cell>
            <Table.Cell>
              <Button
                basic
                color='blue'
                disabled={!api.visibility}
                style={{ width: '100%' }}
                onClick={() => this.updateApiGatewayApi(api)}
              >
                {this.isUpdatingApiGatewayApi(api) ? <Loader active inline size='mini' /> : 'Update'}
              </Button>
            </Table.Cell>
            <Table.Cell>
              <Button
                basic
                // color={api.sdkGeneration ? 'green' : 'red'}
                color='blue'
                style={{ width: '100%' }}
                disabled={!api.visibility || !this.isSdkGenerationConfigurable(api)}
                onClick={() => this.toggleSdkGeneration(store.visibility.apiGateway, api)}
              >
                {api.sdkGeneration ? 'Enabled' : 'Disabled'}
              </Button>
            </Table.Cell>
          </Table.Row>
        </React.Fragment>
      ))}
    </>
  }

  handleDropdownApiChange(e, { value }) {
    this.setState(prev => ({ ...prev, apiSelected: value }))
  }

  render() {
    const apiList = store.visibility.apiGateway.map(api => {
      return {
        key: `${api.name}_${api.stage}`,
        text: `${api.name}_${api.stage}`,
        value: api.id,
      }
    })

    apiList.unshift({
      key: `NONE`,
      text: `NONE`,
      value: `NONE`,
    })

    return (
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{ padding: '2em' }}>
          <Table celled collapsing>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='6'>API Gateway APIs</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell collapsing sorted='ascending'>API Name</Table.HeaderCell>
                <Table.HeaderCell>Stage</Table.HeaderCell>
                <Table.HeaderCell>API Type</Table.HeaderCell>
                <Table.HeaderCell>Displayed</Table.HeaderCell>
                <Table.HeaderCell>Update</Table.HeaderCell>
                <Table.HeaderCell>Allow Generating SDKs</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {this.sortByUsagePlan()}
            </Table.Body>
          </Table>
        </div>

        <div style={{ padding: '2em' }}>
          <Modal
            closeIcon
            closeOnEscape
            closeOnDimmerClick
            onClose={() => this.closeApiModal()}
            trigger={
              <Button
                primary
                style={{ marginBottom: '1em' }}
                onClick={() => this.setState((prev) => ({ ...prev, newApiModalOpen: true }))}
              >
                New API
              </Button>
            }
            open={this.state.newApiModalOpen}
          >
            <Modal.Header>Create new API</Modal.Header>
            <Modal.Content>
              <>
                <Form onSubmit={(e) => this.createAPIGatewayAPI(e)}>
                  {
                    this.state.fileErrors && (
                      <Message negative>
                        <Message.Header>{this.state.errorMessage}</Message.Header>
                      </Message>
                    )
                  }
                  <Form.Field>
                    <label htmlFor='files'>Select File:</label>
                    <Input
                      type='file'
                      id='files'
                      name='files'
                      accept='.json,.yaml,.yml'
                      ref={this.newAPIFileInput}
                      loading={this.state.loadingFile}
                      onChange={(e) => this.uploadNewAPIFile(e)}
                      onClick={(e) => e.target.value = null}
                    />
                    <label htmlFor='api-host'>Host:</label>
                    <input
                      type='text'
                      id='api-host'
                      name='api-host'
                      defaultValue={this.state.apiHost}
                      onChange={(e) => this.setState({ apiHost: e.target.value })}
                    />
                    <label htmlFor='api-name'>API name:</label>
                    <input
                      type='text'
                      id='api-name'
                      name='api-name'
                      defaultValue={this.state.apiName}
                      onChange={(e) => this.setState({ apiName: e.target.value })}
                    />
                    <label htmlFor='api-env'>API Environment:</label>
                    <input
                      type='text'
                      id='api-env'
                      name='api-env'
                      defaultValue={this.state.apiEnv}
                      onChange={(e) => this.setState({ apiEnv: e.target.value })}
                    />
                    <label htmlFor='api-mapping-template'>Mapping Template (application/json):</label>
                    <TextArea 
                      defaultValue={this.state.apiMappingTemplate}
                      style={{ minHeight: 150 }}
                      onChange={(e) => this.setState({ apiMappingTemplate: e.target.value })}
                    />
                  </Form.Field>
                  <Button type='submit'>Create</Button>
                </Form>
              </>
            </Modal.Content>
          </Modal>
          <Table celled collapsing>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='4'>Custom documentation</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='2'>
                  <Modal
                    closeIcon
                    closeOnEscape
                    closeOnDimmerClick
                    onClose={() => this.setState((prev) => ({ ...prev, modalOpen: false }))}
                    trigger={
                      <Button floated='right' onClick={() => this.setState((prev) => ({ ...prev, modalOpen: true }))}>
                        Add Documentation
                      </Button>
                    }
                    open={this.state.modalOpen}
                  >
                    <Modal.Header>Select .JSON, .YAML, or .YML files</Modal.Header>
                    <Modal.Content>
                      <>
                        <Form onSubmit={(e) => this.uploadAPISpec(e)}>
                          <Form.Field>
                            <label htmlFor='files'>Select Files:</label>
                            <input type='file' id='files' name='files' accept='.json,.yaml,.yml' multiple ref={this.fileInput} />
                            <label
                              htmlFor='api-list'
                              style={{ marginTop: '5px' }}
                            >
                              Select the API to which the documentation belongs:
                            </label>
                            <Dropdown
                              id='api-list'
                              placeholder='APIs'
                              search
                              selection
                              options={apiList}
                              onChange={(e, { value }) => this.setState(prev => (
                                { ...prev, apiSelected: value }
                              ))}
                            />
                          </Form.Field>
                          {!!this.state.errors.length &&
                            <Message size='tiny' color='red' list={this.state.errors} header='These files are not parseable or do not contain an api title:' />}
                          <br />
                          <Button type='submit'>Upload</Button>
                        </Form>
                      </>
                    </Modal.Content>
                  </Modal>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell collapsing sorted='ascending'>API Name</Table.HeaderCell>
                <Table.HeaderCell>Delete</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {store.visibility.generic
                ? Object.keys(store.visibility.generic).sort(this.genericTableSort).map(apiId => (
                  <Table.Row key={apiId}>
                    <Table.Cell collapsing>{store.visibility.generic[apiId].name}</Table.Cell>
                    <Table.Cell>
                      <Button
                        basic
                        color='red'
                        onClick={() => this.deleteAPISpec(apiId)}
                      >
                        Delete
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
                : (
                  <Table.Row>
                    <Table.Cell colSpan='4'>
                      No APIs found
                    </Table.Cell>
                  </Table.Row>
                )}
            </Table.Body>
          </Table>
        </div>
      </div>
    )
  }
})
