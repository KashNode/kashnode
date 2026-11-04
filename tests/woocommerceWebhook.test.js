import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { createWooCommerceWebhookHandler } from '../server/routes/woocommerceWebhook.js';

test('accepts signed WooCommerce order and upserts idempotently', async t => {
  const secret = 'merchant-webhook-secret';
  const queries = [];
  const pool = { async query(sql, params) {
    queries.push({sql,params});
    if (sql.includes('SELECT webhook_secret')) return { rows:[{webhook_secret:secret}] };
    return { rows:[{id:'order-1',payment_status:'unpaid',delivery_status:'pending'}] };
  }};
  const app = express();
  app.use(express.json({verify:(req,res,buf)=>{req.rawBody=Buffer.from(buf)}}));
  app.post('/hook', createWooCommerceWebhookHandler({pool}));
  const server = app.listen(0);
  t.after(() => new Promise(resolve=>server.close(resolve)));
  await new Promise(resolve=>server.once('listening',resolve));
  const payload = JSON.stringify({merchant_id:'11111111-1111-4111-8111-111111111111',id:1234,billing:{phone:'+8801712345678',first_name:'Test'},total:'1050.00',payment_method:'bKash'});
  const signature = crypto.createHmac('sha256',secret).update(Buffer.from(payload)).digest('base64');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/hook`,{method:'POST',headers:{'content-type':'application/json','x-wc-webhook-signature':signature},body:payload});
  assert.equal(response.status,202);
  assert.equal((await response.json()).order_id,'order-1');
  assert.match(queries[1].sql,/ON CONFLICT/);
  assert.equal(queries[1].params[2],'+8801712345678');
});
