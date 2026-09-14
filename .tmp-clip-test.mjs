import { chromium, webkit } from 'playwright';
for (const [name, b] of [['chromium', chromium], ['webkit', webkit]]) {
  try {
    const br = await b.launch();
    const p = await br.newPage();
    await p.goto('http://192.168.10.102:8899/');
    await p.click('#b');
    await p.waitForTimeout(300);
    console.log(name, '=>', await p.textContent('#out'));
    await br.close();
  } catch (e) { console.log(name, 'ERR', e.message.split('\n')[0]); }
}
