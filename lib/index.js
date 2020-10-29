'use strict';

const path = require('path');

class Journal {
  constructor(xLog) {
    const xConfig = require('xcraft-core-etc')().load('xcraft');

    this._xLog = xLog;
    this._logDir = path.join(xConfig.xcraftRoot, 'var/log/xcraft');

    this._xLog
      .getLevels()
      .forEach((level) => this._xLog.on(level, (msg) => this.log(level, msg)));

    const rfs = require('rotating-file-stream');
    this._stream = rfs.createStream(path.join(this._logDir, 'xcraft.log'), {
      size: '10M',
      interval: '1d',
      maxFiles: 50,
      compress: 'gzip',
    });
  }

  log(mode, msg) {
    this._stream.write(`${msg.time} [${msg.module}] ${mode}: ${msg.message}\n`);
  }
}

module.exports = (xLog) => new Journal(xLog);
