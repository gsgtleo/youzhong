'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('youzhongSettings', {
  load: () => ipcRenderer.invoke('youzhong:get-server-url'),
  save: (value) => ipcRenderer.invoke('youzhong:set-server-url', value),
  close: () => ipcRenderer.send('youzhong:close-server-settings'),
});
