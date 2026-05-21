const res = await fetch('http://localhost:3001/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'test create' }) });
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
