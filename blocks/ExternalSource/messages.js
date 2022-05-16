let cbMapping = {};

window.addEventListener('message', (e) => {
  let message;
  try {
    message = JSON.parse(e.data);
  } catch (err) {
    return;
  }

  if (message?.type in cbMapping) {
    let cbList = cbMapping[message.type];
    for (let [sender, callback] of cbList) {
      if (e.source === sender) {
        callback(message);
      }
    }
  }
});

const registerMessage = function (type, sender, callback) {
  if (!(type in cbMapping)) {
    cbMapping[type] = [];
  }

  cbMapping[type].push([sender, callback]);
};

const unregisterMessage = function (type, sender) {
  if (type in cbMapping) {
    cbMapping[type] = cbMapping[type].filter((item) => item[0] !== sender);
  }
};

export { registerMessage, unregisterMessage };
