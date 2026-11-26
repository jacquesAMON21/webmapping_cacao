// ===== Atlas des planteurs de cacao : logique =====
var byId={};
var P=PLANTEURS.map(function(r){
  var o={id:r[0],nom:r[1],village:r[2],zone:r[3],lat:r[4],lon:r[5],ha:r[6],variete:r[7],age:r[8],rend:r[9],cert:r[10],coop:r[11]};
  byId[o.id]=o;return o;
});

function fmt(n){return n.toFixed(1).replace(".",",")}
function couleur(ha){return ha<3?"#8aa0ff":ha<=6?"#f5a524":"#3ee0b0"}
function initiales(n){return n.split(" ").map(function(m){return m[0]}).join("").slice(0,2).toUpperCase()}

// --- Carte et fonds ---
var map=L.map("map",{zoomControl:false,center:[6.2,-5.3],zoom:7,scrollWheelZoom:true,maxBoundsViscosity:0.8});
L.control.zoom({position:"bottomleft"}).addTo(map);
var osm=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
var googleSatellite=L.tileLayer("https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",{maxZoom:20,subdomains:"0123",attribution:"© Google"}).addTo(map);
var openTopo=L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:17,attribution:"© OpenTopoMap, © OSM"});
//var sombre=L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{attribution:"© OpenStreetMap © CARTO",maxZoom:18});
var markers=L.layerGroup().addTo(map);
var ctrl=L.control.layers({"Satellite Google":googleSatellite,"OpenStreetMap":osm,"OpenTopoMap":openTopo},{"Exploitations (points)":markers},{collapsed:true,position:"bottomright"}).addTo(map);

// --- Popup ---
function popup(p){
  return '<div class="pp"><h3>'+p.nom+'</h3><span class="sub">'+p.village+' · '+p.zone+'</span>'+
  '<div class="kv"><div><small>Surface</small><b>'+fmt(p.ha)+' ha</b></div>'+
  '<div><small>Rendement</small><b>'+p.rend+' kg/ha</b></div>'+
  '<div><small>Variété</small><b>'+p.variete+'</b></div>'+
  '<div><small>Âge du verger</small><b>'+p.age+' ans</b></div>'+
  '<div><small>Production estimée</small><b>'+fmt(p.ha*p.rend/1000)+' t/an</b></div>'+
  '<div><small>Certification</small><b>'+p.cert+'</b></div></div>'+
  '<div class="tags"><span>'+p.coop+'</span></div>'+
  '<button class="zb" type="button" data-id="'+p.id+'">Zoom sur l’exploitation</button></div>';
}
map.on("popupopen",function(e){
  var b=e.popup.getElement().querySelector(".zb");
  if(b)b.onclick=function(){var p=byId[b.dataset.id];map.flyTo([p.lat,p.lon],16,{duration:1.2})};
});

// --- Marqueurs et liste ---
var mk={};
P.forEach(function(p){
  mk[p.id]=L.circleMarker([p.lat,p.lon],{radius:8+p.ha*.9,color:"#fff",weight:2,fillColor:couleur(p.ha),fillOpacity:.85})
    .bindTooltip(p.nom,{direction:"top"}).bindPopup(popup(p),{maxWidth:290});
});
var items=document.getElementById("items"),q=document.getElementById("q");
function rendre(txt){
  txt=(txt||"").toLowerCase();markers.clearLayers();
  var liste=P.filter(function(p){return (p.nom+" "+p.village+" "+p.zone).toLowerCase().indexOf(txt)>-1});
  items.innerHTML=liste.length?liste.map(function(p){
    return '<div class="it" data-id="'+p.id+'"><i style="--c:'+couleur(p.ha)+'">'+initiales(p.nom)+'</i><div><b>'+p.nom+'</b><small>'+p.village+' · '+p.zone+' · '+fmt(p.ha)+' ha</small></div></div>'
  }).join(""):'<div class="vide">Aucun résultat</div>';
  liste.forEach(function(p){markers.addLayer(mk[p.id])});
  items.querySelectorAll(".it").forEach(function(el){el.onclick=function(){
    var p=byId[el.dataset.id];map.flyTo([p.lat,p.lon],12,{duration:1.2});
    map.once("moveend",function(){mk[p.id].openPopup()});
    setListOpen(false);
  }});
}
q.oninput=function(){rendre(q.value)};
var list=document.getElementById("list"),listToggle=document.getElementById("lt");
function setListOpen(open){
  list.classList.toggle("open",open);
  list.setAttribute("aria-hidden",String(!open));
  listToggle.setAttribute("aria-expanded",String(open));
  listToggle.textContent=open?"Masquer la liste":"Afficher la liste";
}
listToggle.onclick=function(){setListOpen(!list.classList.contains("open"))};
var titlePanel=document.getElementById("t"),titleToggle=document.getElementById("tt");
titleToggle.onclick=function(){
  var open=titlePanel.classList.contains("closed");
  titlePanel.classList.toggle("closed",!open);
  titlePanel.setAttribute("aria-hidden",String(!open));
  titleToggle.setAttribute("aria-expanded",String(open));
  titleToggle.textContent=open?"Masquer l’atlas":"Afficher l’atlas";
};
rendre("");

// --- Chiffres clés ---
var tot=P.reduce(function(s,p){return s+p.ha},0);
document.getElementById("st").innerHTML='<span>'+P.length+' planteurs</span><span>'+fmt(tot)+' ha</span><span>'+fmt(tot/P.length)+' ha en moyenne</span>';

// --- Couche GeoJSON des plantations (polygones) ---
// Dépose ton fichier dans data/plantations.geojson. Propriété optionnelle "planteur_id" (P01…P20)
// pour relier un polygone à un planteur et réutiliser son popup.
var STYLE={color:"#3ee0b0",weight:2,fillColor:"#3ee0b0",fillOpacity:.25};
if(typeof fetch==="function"){
  fetch("data/plantations.geojson").then(function(r){return r.ok?r.json():null}).then(function(gj){
    if(!gj||!gj.features||!gj.features.length)return;
    var polys=L.geoJSON(gj,{
      style:function(){return STYLE},
      onEachFeature:function(f,l){
        var pr=f.properties||{},p=byId[pr.planteur_id];
        l.bindPopup(p?popup(p):'<div class="pp"><h3>'+(pr.nom||"Plantation")+'</h3></div>',{maxWidth:290});
        l.on("mouseover",function(){l.setStyle({fillOpacity:.5,weight:3})});
        l.on("mouseout",function(){l.setStyle(STYLE)});
      }
    }).addTo(map);
    ctrl.addOverlay(polys,"Plantations (polygones)");
  }).catch(function(){});
}
