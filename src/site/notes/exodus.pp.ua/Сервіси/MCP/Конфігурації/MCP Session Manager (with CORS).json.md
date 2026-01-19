---
{"title":"MCP Session Manager (with CORS).json","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Конфігурації/MCP Session Manager (with CORS).json/","dgPassFrontmatter":true,"noteIcon":""}
---



{
  "name": "MCP Session Manager (with CORS)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "==",
        "path": "mcp-create",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "d07f3837-7abf-4da5-86d5-233e5ee1ba0a",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [
        -448,
        112
      ],
      "webhookId": "mcp-create"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.method }}",
              "value2": "OPTIONS"
            }
          ]
        }
      },
      "id": "20e452a2-37f7-4de9-bc3a-3932b34edc3f",
      "name": "Check if OPTIONS",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        -224,
        112
      ]
    },
    {
      "parameters": {
        "respondWith": "noData",
        "options": {
          "responseHeaders": {
            "entries": [
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              },
              {
                "name": "Access-Control-Allow-Methods",
                "value": "GET, POST, OPTIONS"
              },
              {
                "name": "Access-Control-Allow-Headers",
                "value": "Content-Type, Authorization"
              },
              {
                "name": "Access-Control-Max-Age",
                "value": "86400"
              }
            ]
          }
        }
      },
      "id": "998da3ed-0cdc-400a-afc0-7424438c8ae2",
      "name": "Respond OPTIONS",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [
        0,
        0
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://garden-mcp-server.maxfraieho.workers.dev/sessions/create",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json }}",
        "options": {}
      },
      "id": "92bb264e-b102-4ebc-bab2-cde3eb927e42",
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        0,
        208
      ],
      "credentials": {
        "httpHeaderAuth": {
          "id": "hTSG42fXOq6JOYV9",
          "name": "Cloudflare MCP Worker"
        }
      }
    },
    {
      "parameters": {
        "mode": "runOnceForEachItem",
        "jsCode": "return { sessionUrl: `https://n8n.exodus.pp.ua/mcp-session/${$json.sessionId}` };"
      },
      "id": "208a0214-3467-4e1a-9e09-abe7ea6787cb",
      "name": "Code in JavaScript",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        224,
        208
      ]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "field1",
              "name": "sessionId",
              "type": "string",
              "value": "={{ $('HTTP Request').item.json.sessionId }}"
            },
            {
              "id": "field2",
              "name": "sessionUrl",
              "type": "string",
              "value": "={{ $('Code').item.json.sessionUrl }}"
            }
          ]
        },
        "options": {}
      },
      "id": "936caaf1-8ec3-4f21-b02a-3bd246781496",
      "name": "Edit Fields",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.3,
      "position": [
        448,
        208
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}",
        "options": {
          "responseHeaders": {
            "entries": [
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              },
              {
                "name": "Access-Control-Allow-Methods",
                "value": "GET, POST, OPTIONS"
              },
              {
                "name": "Access-Control-Allow-Headers",
                "value": "Content-Type, Authorization"
              }
            ]
          }
        }
      },
      "id": "3f029691-b664-407d-aed8-528c3df60858",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [
        672,
        208
      ]
    }
  ],
  "pinData": {},
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Check if OPTIONS",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Check if OPTIONS": {
      "main": [
        [
          {
            "node": "Respond OPTIONS",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Code in JavaScript",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code in JavaScript": {
      "main": [
        [
          {
            "node": "Edit Fields",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  },
  "versionId": "4e3a4bba-c4a4-4530-bd0f-8bf1d565c43f",
  "meta": {
    "instanceId": "558d88703fb65b2d0e44613bc35916258b0f0bf983c5d4730c00c424b77ca36a"
  },
  "id": "31h1PqQrLmVqhSYA",
  "tags": []
}