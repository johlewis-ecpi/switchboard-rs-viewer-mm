const vm = require('node:vm');
class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.listeners=new Map();this.hidden=false;this.value='';this.style={props:{},setProperty(k,v){this.props[k]=v;}};this.checked=false;this._text='';
    const classes=new Set();this.classList={toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)};
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value){throw Error('Document data must never reach innerHTML');}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this._text='';this.children=[...children];}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,fn,{signal}={}){this.listeners.set(name,fn);signal?.addEventListener('abort',()=>this.listeners.delete(name),{once:true});}
  dispatch(name){this.listeners.get(name)?.({target:this});}
}
function dom(){const nodes=Object.fromEntries(['content','error','status'].map(id=>[id,new Element()]));nodes.error.hidden=true;return{nodes,createElement:tag=>new Element(tag),getElementById:id=>nodes[id]};}
function find(node,predicate){if(predicate(node))return node;for(const child of node.children){const found=find(child,predicate);if(found)return found;}return null;}
function environment(){const messages=[],listeners=new Map();const parent={postMessage:message=>messages.push(message)};return{
  messages,parent,AbortController,requestAnimationFrame:fn=>queueMicrotask(fn),
  addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
  dispatch:message=>listeners.get('message')?.({source:parent,data:message}),
  spoof:message=>listeners.get('message')?.({source:{},data:message}),listeners
};}
function open(request=1,text='<map/>',extension='mm'){return{type:'switchboard:open',apiVersion:1,request,document:{name:'sample.'+extension,extension,text,readOnly:true}};}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function executeBundle(html,environment,document){
  const match=html.match(/<script>([\s\S]*?)<\/script>/i);if(!match)throw Error('No inline script');
  const context=vm.createContext({...environment,document});vm.runInContext(match[1],context);return context;
}
module.exports={Element,dom,find,environment,open,settle,executeBundle};
