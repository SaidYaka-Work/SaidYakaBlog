(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const startBtn = document.getElementById('start');
  let width = canvas.width, height = canvas.height;
  let score=0, timeLeft=30, running=false, objects=[];

  function rand(min,max){return Math.random()*(max-min)+min}
  function spawn(){
    const r = rand(12,26);
    objects.push({x:rand(r,width-r),y:rand(r,height-r),r, vx:rand(-0.6,0.6), vy:rand(-0.6,0.6), t:Date.now()});
  }

  function draw(){
    ctx.clearRect(0,0,width,height);
    // background stalls
    const g = ctx.createLinearGradient(0,0,width,0);
    g.addColorStop(0,'#071226');g.addColorStop(1,'#102233');
    ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    // objects
    for(const o of objects){
      ctx.beginPath();ctx.fillStyle='#ffb86b';ctx.globalAlpha=0.95;ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      ctx.beginPath();ctx.fillStyle='rgba(0,0,0,0.15)';ctx.arc(o.x,o.y+o.r*0.5,o.r*0.6,0,Math.PI*2);ctx.fill();
    }
  }

  function update(dt){
    for(const o of objects){
      o.x += o.vx*dt; o.y += o.vy*dt;
      if(o.x<o.r||o.x>width-o.r) o.vx*=-1;
      if(o.y<o.r||o.y>height-o.r) o.vy*=-1;
    }
    // occasionally spawn
    if(Math.random()<0.02) spawn();
    objects = objects.filter(o => Date.now()-o.t < 12000);
  }

  let last=0;
  function loop(ts){
    if(!running) return;
    if(!last) last=ts; const dt = (ts-last)/16.666; last=ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start(){
    score=0;timeLeft=30;objects=[];running=true;scoreEl.textContent=score;timeEl.textContent=timeLeft;last=0;spawn();requestAnimationFrame(loop);
    timer = setInterval(()=>{timeLeft--;timeEl.textContent=timeLeft; if(timeLeft<=0) end();},1000);
  }
  function end(){running=false; clearInterval(timer); alert('Time! Your score: '+score);}

  canvas.addEventListener('click',e=>{
    if(!running) return; const rect=canvas.getBoundingClientRect(); const x=(e.clientX-rect.left)*(canvas.width/rect.width); const y=(e.clientY-rect.top)*(canvas.height/rect.height);
    for(let i=objects.length-1;i>=0;i--){const o=objects[i];const dx=o.x-x,dy=o.y-y; if(dx*dx+dy*dy <= o.r*o.r){ objects.splice(i,1); score+=1; scoreEl.textContent=score; if(score%10===0) flash(); break; }}
  });

  document.addEventListener('keydown',e=>{ if(e.code==='Space'){ e.preventDefault(); // try to click center
    const evt = {clientX:canvas.getBoundingClientRect().left+canvas.width*(0.5), clientY: canvas.getBoundingClientRect().top+canvas.height*(0.5)}; }
  });

  function flash(){ document.body.animate([{filter:'hue-rotate(0deg)'},{filter:'hue-rotate(60deg)'},{filter:'hue-rotate(0deg)'}],{duration:900}); }

  startBtn.addEventListener('click', ()=>{ if(running){ end(); startBtn.textContent='Start'; } else { start(); startBtn.textContent='Restart'; }});
})();
