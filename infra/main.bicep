param accountName string
param location string = resourceGroup().location
param ownerToken string
param principalId string = ''
param assignInferenceRole bool = true
param deploymentName string = 'sunburst'
param modelVersion string = '2026-09-08'

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  kind: 'AIServices'
  sku: { name: 'S0' }
  tags: {
    project: 'image-gen-mcp'
    ownerToken: ownerToken
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: account
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-image-2.5-sunburst'
      version: modelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

resource inferenceRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignInferenceRole) {
  name: guid(account.id, principalId, 'image-gen-inference')
  scope: account
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
    principalId: principalId
    principalType: 'User'
  }
}

output resourceId string = account.id
output endpoint string = 'https://${accountName}.openai.azure.com/'
output imageDeployment string = deployment.name
