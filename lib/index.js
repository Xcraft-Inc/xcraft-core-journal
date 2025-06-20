'use strict';

const path = require('path');

const streams = {};

class Journal {
  constructor(xLog) {
    const xConfig = require('xcraft-core-etc')().load('xcraft');

    this._xLog = xLog;
    this._logDir = path.join(xConfig.xcraftRoot, 'var/log/xcraft');

    this._xLog
      .getLevels()
      .forEach((level) => this._xLog.on(level, (msg) => this.log(level, msg)));

    // HACK: the fallback for 'host' is for electron > 27 where ESM is the default
    this._id = path.basename(require.main?.filename || 'host');
    if (streams[this._id]) {
      return;
    }

    const rfs = require('rotating-file-stream');
    try {
      streams[this._id] = rfs
        .createStream(`xcraft.${this._id}.log`, {
          size: '1M',
          interval: '1d',
          maxFiles: 50,
          compress: 'gzip',
          path: this._logDir,
        })
        .on('error', (ex) => {
          console.error(ex.stack || ex.message || ex);
          delete streams[this._id];
        });
    } catch (ex) {
      /* Don't use xLog here in order to prevent a larsen. */
      console.error(ex.stack || ex.message || ex);
    }
  }

  log(mode, msg) {
    if (!streams[this._id]) {
      return;
    }

    try {
      streams[this._id].write(
        `${msg.time} [${msg.module}] ${mode}: ${msg.message}\n`
      );
    } catch (ex) {
      /* Don't use xLog here in order to prevent a larsen. */
      console.error(ex.stack || ex.message || ex);
    }
  }
}

module.exports = (xLog) => new Journal(xLog);
