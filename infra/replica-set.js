// mongosh script, local single-node replica set only. No application data is inserted.
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const admin = new Mongo('mongodb://mongo:27017/admin?directConnection=true&serverSelectionTimeoutMS=1000&connectTimeoutMS=1000').getDB('admin');
    let result;
    try { result = admin.runCommand({ replSetGetConfig: 1 }); }
    catch (error) {
      if (error.code !== 94) throw error;
      result = { code: 94 };
    }
    if (result.code === 94) {
      const initialized = admin.runCommand({ replSetInitiate: {
        _id: 'vfb-rs', members: [{ _id: 0, host: 'mongo:27017' }],
      } });
      if (initialized.ok !== 1 && initialized.code !== 23) throw new Error('Initialization failed.');
    } else if (result.ok !== 1) {
      throw new Error('Replica configuration unavailable.');
    } else if (result.config._id !== 'vfb-rs' || result.config.members.length !== 1 ||
      result.config.members[0].host !== 'mongo:27017') {
      print('Existing replica configuration does not match local setup; refusing to reconfigure.');
      quit(1);
    }
    const hello = admin.runCommand({ hello: 1 });
    if (hello.setName === 'vfb-rs' && hello.isWritablePrimary && hello.logicalSessionTimeoutMinutes != null) {
      ready = true; break;
    }
  } catch { /* Bounded retry during first boot; no driver error/connection string output. */ }
  sleep(500);
}
print(ready ? 'Local replica set is ready.' : 'Local replica-set initialization timed out.');
quit(ready ? 0 : 1);
