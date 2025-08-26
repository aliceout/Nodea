/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != ''",
    "deleteRule": "@request.query.sid = module_user_id && @request.query.d = guard",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text202763660",
        "max": 0,
        "min": 0,
        "name": "module_user_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1110206997",
        "max": 0,
        "min": 0,
        "name": "payload",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3201413635",
        "max": 0,
        "min": 0,
        "name": "cipher_iv",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": true,
        "id": "text2937197516",
        "max": 0,
        "min": 0,
        "name": "guard",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      }
    ],
    "id": "pbc_1148030965",
    "indexes": [
      "CREATE INDEX idx_mood_entries_module_user_id ON mood_entries(module_user_id)"
    ],
    "listRule": "@request.query.sid = module_user_id",
    "name": "mood_entries",
    "system": false,
    "type": "base",
    "updateRule": "@request.query.sid = module_user_id && @request.query.d = guard",
    "viewRule": "@request.query.sid = module_user_id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1148030965");

  return app.delete(collection);
})
