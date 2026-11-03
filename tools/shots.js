#!/usr/bin/env node
// Visual check harness (Playwright, headless Chromium).
//   node tools/shots.js --out DIR --track ID [--race] [--at z1,z2,...] [--drive SECS --every SECS]
//                       [--size 844x390] [--scale 1] [--menus]
// --at     freeze the game and screenshot with the player placed at each z (m)
// --drive  autopilot drives the player in real time; screenshot every N seconds
// --race   include the AI opponent (league race); default is practice
// --menus  screenshot title/main/setup screens first
// Prints page errors and a JSON line of game state for each shot.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const out = path.resolve(opt('out', 'shots'));
const trackId = opt('track', 'kicker');
const [vw, vh] = String(opt('size', '844x390')).split('x').map(Number);
const scale = Number(opt('scale', 1));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: scale, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);

  const snap = async name => {
    const f = path.join(out, name + '.png');
    await page.screenshot({ path: f });
    const info = await page.evaluate(() => Game._debug.info);
    console.log(f, JSON.stringify(info));
  };

  if (opt('menus')) {
    await snap('menu_title');
    await page.click('#start-btn');
    await page.waitForTimeout(150);
    await snap('menu_main');
    await page.click('#btn-practice');
    await page.waitForTimeout(150);
    await snap('menu_practice');
  }

  await page.evaluate(([id, race]) => { Game._debug.start(id, !race); Game._debug.go(); }, [trackId, !!opt('race')]);

  const at = opt('at');
  if (at && at !== true) {
    await page.evaluate(() => { Game._debug.frozen = true; });
    for (const z of String(at).split(',').map(Number)) {
      await page.evaluate(zz => { Game._debug.place('player', zz, { speed: 60 }); }, z);
      await page.waitForTimeout(120);
      await snap(`${trackId}_z${z}`);
    }
    await page.evaluate(() => { Game._debug.frozen = false; });
  }

  const drive = Number(opt('drive', 0));
  if (drive) {
    const every = Number(opt('every', 2));
    await page.evaluate(() => { Game._debug.autopilot = true; });
    for (let s = every; s <= drive; s += every) {
      await page.waitForTimeout(every * 1000);
      await snap(`${trackId}_t${s}`);
    }
  }

  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  else console.log('no page errors');
  await browser.close();
})();
