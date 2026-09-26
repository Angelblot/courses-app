const assert = require('node:assert/strict');
(async () => {
  const {convertToProductQty} = await import('../../frontend/src/lib/unitConverter.js');
  const pack = {unit:'unité',grammage_g:500};
  assert.equal(convertToProductQty(1,'kg',pack).qty,2);
  assert.equal(convertToProductQty(750,'g',pack).qty,2);
  assert.equal(convertToProductQty(1,'L',{unit:'unité',volume_ml:250}).qty,4);
  assert.equal(convertToProductQty(50,'cl',{unit:'unité',volume_ml:250}).qty,2);
  assert.equal(convertToProductQty(1,'kg',{unit:'g'}).qty,1000);
  assert.equal(convertToProductQty(100,'g',{unit:'unité'}).qty,0);
  console.log('PASS: metric quantities and unknown packaging.');
})().catch(e=>{console.error(e);process.exitCode=1;});
