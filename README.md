# Interesting-Simultaion

Aqui se presentarán simulaciones de los campos de la física, la biologia y las matematicas. Cada simulación cuenta con su código, requisitos y definicion de parametros, ademas de una breve explicación de lo que se simula.

---
## Previas
| Simulación | Enlace Visual |
| :--- | :--- |
| **Fluido Cuántico** | [Ver Simulación Visual](./Fluido%20Cuántico/fluido_cuantico.gif) |
| **Crecimiento Fractal** |  [Visualizar GIF](./crecimiento_fractal.gif) |


## 1. Fluido Cuántico (Ecuación Ginzburg-Landau)
[Ver Simulación Visual](./Fluido%20Cuántico/fluido_cuantico.gif)

**Descripción:**
Simulación de la ecuación compleja de Ginzburg-Landau (CGL), que modela la transición al caos y la formación de defectos topológicos (vórtices) en fluidos cuánticos y sistemas no lineales.

**Parámetros Ajustables:**
* `ALPHA`: Controla la difusión compleja (difusión + dispersión).
* `BETA`: Define la no-linealidad reactiva del sistema.
* `GAMMA`: Determina la ruptura de simetría (acoplamiento al conjugado).

**Requisitos:**
- Python 3.x, `numpy`, `pygame`, `imageio` 

---

## 2. Crecimiento Fractal (Modelo Gray-Scott)
[Ver Simulación](./crecimiento_fractal.gif)

**Descripción:**
Simulación de sistemas de Reacción-Difusión basada en el modelo de Gray-Scott. Representa la interacción química entre dos sustancias que genera patrones fractales y estructuras ramificadas similares a procesos biológicos.

**Parámetros Ajustables:**
* `feed_rate`: Velocidad de alimentación del nutriente al sistema.
* `kill_rate`: Tasa de eliminación de la sustancia reactiva.
* `dt`: Paso de tiempo (afecta la velocidad y estabilidad de la reacción).

**Requisitos:**
- Python 3.x, `numpy`, `pygame`, `imageio` 
