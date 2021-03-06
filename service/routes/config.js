/*    Copyright 2019-2021 Firewalla Inc.
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const log = require('../../util/logger.js')(__filename);
const ncm = require('../../core/network_config_mgr.js');
const ns = require('../../core/network_setup.js');

router.get('/active', async (req, res, next) => {
  const config = await ncm.getActiveConfig();
  if(config) {
    res.json(config);
  } else {
    res.status(404).send('');
  }
});

router.get('/wans', async (req, res, next) => {
  await ncm.getWANs().then((wans) => {
    res.status(200).json(wans);
  }).catch((err) => {
    res.status(500).json({errors: [err.message]});
  });
});

router.get('/lans', async (req, res, next) => {
  await ncm.getLANs().then((lans) => {
    res.status(200).json(lans);
  }).catch((err) => {
    res.status(500).json({errors: [err.message]});
  });
});

router.get('/wlan/:intf/available', async (req, res, _next) => {
  await ncm.getWlanAvailable(req.params.intf).then(lans => {
    res.status(200).json(lans);
  }).catch(err => {
    res.status(500).json({errors: [err.message]});
  });
});

router.get('/phy_interfaces', async (req, res, next) => {
  await ncm.getPhyInterfaceNames().then((intfs) => {
    res.status(200).json({intfs: intfs});
  }).catch((err) => {
    res.status(500).json({errors: [err.message]});
  });
});

router.get('/interfaces/:intf', async (req, res, next) => {
  const intf = req.params.intf;
  await ncm.getInterface(intf).then((result) => {
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).send('');
    }
  }).catch((err) => {
    res.status(500).json({errors: [err.message]});
  });
});

router.get('/interfaces', async (req, res, next) => {
  await ncm.getInterfaces().then((result) => {
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).send('');
    }
  }).catch((err) => {
    res.status(500).json({errors: [err.message]});
  })
});

const jsonParser = bodyParser.json()

router.post('/set',
  jsonParser,
  async (req, res, next) => {
    const newConfig = req.body;
    let errors = await ncm.validateConfig(newConfig);
    if (errors && errors.length != 0) {
      log.error("Invalid network config", errors);
      res.json({errors: errors});
    } else {
      errors = await ncm.tryApplyConfig(newConfig);
      if (errors && errors.length != 0) {
        log.error("Failed to apply new network config", errors);
        res.status(400).json({errors: errors});
      } else {
        log.info("New config is applied with no error");
        await ncm.saveConfig(newConfig);
        res.status(200).json({errors: errors});
      }
    }
  });

router.post('/prepare_env',
  jsonParser,
  async (req, res, next) => {
    await ns.prepareEnvironment().then(() => {
      res.status(200).json({errors: []});
    }).catch((err) => {
      res.status(500).json({errors: [err.message]});
    })
  })

router.post('/apply_current_config',
  jsonParser,
  async (req, res, next) => {
    const currentConfig = await ncm.getActiveConfig();
    if (currentConfig) {
      let errors = await ncm.validateConfig(currentConfig);
      if (errors && errors.length != 0) {
        log.error("Invalid network config", errors);
        res.json({errors: errors});
      } else {
        errors = await ncm.tryApplyConfig(currentConfig);
        if (errors && errors.length != 0) {
          log.error("Failed to apply current network config", errors);
          res.status(400).json({errors: errors});
        } else {
          log.info("Current config is applied with no error");
          await ncm.saveConfig(currentConfig);
          res.status(200).json({errors: errors});
        }
      }
    } else {
      res.status(404).send("Network config is not set.");
    }
  });

module.exports = router;
