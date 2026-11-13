"""Arma ../canal-de-agua.html (un solo archivo) y su .zip a partir de las fuentes.
Requiere three.js r128:  npm install three@0.128.0
Uso:  python3 construir.py ruta/a/node_modules/three/build/three.min.js
"""
import sys, pathlib, zipfile
aqui = pathlib.Path(__file__).parent
three = pathlib.Path(sys.argv[1]).read_text()
s = (aqui / 'index.src.html').read_text()
s = s.replace('/*BASE*/null', (aqui / 'base.json').read_text().strip())
s = s.replace('/*WALLS*/', (aqui / 'canal.js').read_text())
s = s.replace('<script>/*THREE*/</script>', '<script>' + three + '</script>')
salida = aqui.parent / 'canal-de-agua.html'
salida.write_text(s)
with zipfile.ZipFile(salida.with_suffix('.zip'), 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write(salida, salida.name)
print(salida.name + ':', len(s) // 1024, 'KB')
