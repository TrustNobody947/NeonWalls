package io.github.trustnobody947.elektroplasma

/**
 * Shader des Plasmas. AUTOMATISCH ERZEUGT aus vorschau/quellen/effects/elektroplasma.js
 * (python3 vorschau/quellen/shader_export.py) – bitte dort ändern, damit Vorschau und App gleich bleiben.
 * Enthält das 3D-Simplex-Rauschen von Ashima Arts / Stefan Gustavson (webgl-noise, MIT-Lizenz).
 */
object PlasmaShader {
    const val VERTEX = "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}"

    const val FRAGMENT = """#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uAsp;uniform float uT;uniform float uF;uniform float uSym;uniform float uMove;
uniform float uThick;uniform vec3 uK;uniform vec3 uG;uniform vec3 uH;uniform vec2 uDrift;uniform vec4 uTouch[4];uniform vec4 uLook;uniform vec3 uOct;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// Feld: grobe Lage für die Form, feinere Lagen für das Zucken der Linien
float field(vec2 p){
  vec2 q=p*uF+uDrift;
  if(uMove>0.5){
    // komplexe Bewegung: das Feld wird zusätzlich leicht und wechselnd verbogen (die Form bleibt gleich)
    q+=vec2(snoise(vec3(p*1.6,uT*0.45+5.0)),snoise(vec3(p*1.6+7.3,uT*0.45+11.0)))*0.22;
  }
  float n=snoise(vec3(q,uT));
  n+=uOct.x*snoise(vec3(q*2.07+vec2(17.3,3.1),uT*1.2+31.0));
  n+=uOct.y*snoise(vec3(q*4.31+vec2(-9.7,23.9),uT*1.45+57.0));
  n+=uOct.z*snoise(vec3(q*9.13+vec2(41.2,-15.4),uT*1.8+91.0));
  return n;
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uRes.x;
  vec2 c=vec2(0.5,uAsp*0.5);
  if(uSym>0.5)p.x=c.x-abs(p.x-c.x);
  if(uSym>1.5)p.y=c.y-abs(p.y-c.y);
  float n=field(p);
  for(int i=0;i<4;i++){
    vec4 tc=uTouch[i];
    if(tc.z>0.001){
      vec2 tp=tc.xy;
      if(uSym>0.5)tp.x=c.x-abs(tp.x-c.x);
      if(uSym>1.5)tp.y=c.y-abs(tp.y-c.y);
      vec2 d=p-tp;
      n+=tc.z*exp(-dot(d,d)*55.0);
    }
  }
  // Linien bei ganzzahligen Feldwerten. Drei Farbschichten: Nebel außen, Rand um die Mitte, ganz dünne Mittellinie
  float s=abs(sin(n*3.14159265));
  float I=pow(uThick/max(s,0.0005),uLook.x);
  // von außen nach innen übereinander: Nebel, darüber der Rand, darüber die Mittellinie (schwarz = Schicht aus)
  float wG=smoothstep(0.5,1.25,I),wK=smoothstep(2.4,4.6,I);
  float aG=max(uG.r,max(uG.g,uG.b)),aK=max(uK.r,max(uK.g,uK.b));
  vec3 col=uH*min(I,1.5)*uLook.y;
  col=col*(1.0-wG*aG)+uG*wG*1.4;
  col=col*(1.0-wK*aK)+uK*wK*2.2;
  col=1.0-exp(-col*uLook.w);
  gl_FragColor=vec4(col,1.0);
}"""

    /** Zweiter Schritt: das kleinere Plasma-Bild weich auf den ganzen Bildschirm ziehen. */
    const val BLIT_VERTEX = "attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}"
    const val BLIT_FRAGMENT = "precision mediump float;uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=texture2D(t,v);}"
}
