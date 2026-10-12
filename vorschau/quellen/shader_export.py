#!/usr/bin/env python3
"""Überträgt den Plasma-Shader aus der Vorschau (effects/elektroplasma.js) in die App (PlasmaShader.kt).
So zeigen Vorschau und App genau dasselbe Bild. Aufruf: python3 shader_export.py"""
import pathlib, re

SRC = pathlib.Path(__file__).parent / 'effects' / 'elektroplasma.js'
OUT = pathlib.Path(__file__).parents[2] / 'plasma/src/main/java/io/github/trustnobody947/elektroplasma/PlasmaShader.kt'

js = SRC.read_text()
noise = re.search(r"const NOISE = `(.*?)`;", js, re.S).group(1)
fs = re.search(r"const FS = `(.*?)`;", js, re.S).group(1).replace('${NOISE}', noise)
vs = re.search(r"const VS = '(.*?)';", js).group(1)
assert '$' not in fs and '"""' not in fs

kt = '''package io.github.trustnobody947.elektroplasma

/**
 * Shader des Plasmas. AUTOMATISCH ERZEUGT aus vorschau/quellen/effects/elektroplasma.js
 * (python3 vorschau/quellen/shader_export.py) – bitte dort ändern, damit Vorschau und App gleich bleiben.
 * Enthält das 3D-Simplex-Rauschen von Ashima Arts / Stefan Gustavson (webgl-noise, MIT-Lizenz).
 */
object PlasmaShader {
    const val VERTEX = "%s"

    const val FRAGMENT = """%s"""

    /** Zweiter Schritt: das kleinere Plasma-Bild weich auf den ganzen Bildschirm ziehen. */
    const val BLIT_VERTEX = "attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}"
    const val BLIT_FRAGMENT = "precision mediump float;uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=texture2D(t,v);}"
}
''' % (vs, fs.strip('\n'))
OUT.write_text(kt)
print(OUT)
