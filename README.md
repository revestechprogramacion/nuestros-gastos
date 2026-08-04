# Nuestros Gastos 💸

Los gastos de casa, compartidos entre los dos, en el móvil.

Es una **web-app instalable**: se abre una vez en Safari, se añade a la pantalla
de inicio del iPhone y a partir de ahí funciona como una app normal (icono
propio, pantalla completa, sin barra de navegador). No hace falta App Store ni
pagar la cuota anual de Apple.

---

## Qué hace

| | |
|---|---|
| **Apuntar un gasto** | Importe, categoría de un toque y listo. Opcionalmente nota y foto del ticket. |
| **Resumen del mes** | Cuánto lleváis, comparado con el mes anterior, y en qué se ha ido. |
| **Gastos fijos** | Préstamos, hipoteca, seguros… se apuntan solos el día que toca. La app los **detecta sola** en el histórico del banco. |
| **Presupuesto** | Tope mensual por categoría, con aviso cuando os acercáis. |
| **Importar del banco** | Subes el Excel (.xlsx) o el CSV de movimientos y la app lo categoriza sola, aprendiendo de tus correcciones. |
| **Buscar** | Por nota, categoría o importe, filtrando por mes. |
| **Compartido** | Lo que apunta uno le aparece al otro al instante. |
| **Exportar** | Todo a CSV para abrirlo en Excel o Numbers. |

Todo en euros y en español, en negro y rojo.

**Solo se dan por hechos los recibos que valen siempre lo mismo.** La luz y el
agua cambian cada mes: apuntarlas por adelantado con un importe inventado
descuadraría el total, así que esas se traen del banco con su cifra real.

**El dinero que no se gasta no cuenta.** Los traspasos a vuestra otra cuenta se
registran, pero no suman en el «gastado este mes». Se apaga y se enciende por
categoría, en Categorías → «Cuenta como gasto».

---

## Ponerla en marcha

Son tres pasos. El primero ya funciona **ahora mismo, sin crear ninguna cuenta**.

### Paso 1 — Probarla en el Mac (0 minutos)

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>. Escribe cualquier email y entra.

En este modo los datos se guardan **solo en este navegador** y no se comparten:
sirve para trastear sin miedo. Los pasos 2 y 3 son los que la convierten en una
app de verdad compartida entre los dos móviles.

### Paso 2 — La base de datos (Supabase, gratis)

1. Entra en <https://supabase.com> y crea una cuenta (botón *Start your project*).
2. Crea un proyecto nuevo. Elige la región **West EU (Ireland)**, que es la más
   cercana. Apúntate la contraseña que te pida: no la necesitarás para la app,
   pero sí para entrar a la base de datos si algún día hace falta.
3. Cuando termine de crearse (tarda un par de minutos), en el menú de la
   izquierda entra en **SQL Editor** → **New query**.
4. Abre el archivo [`supabase/esquema.sql`](supabase/esquema.sql) de este
   proyecto, cópialo **entero** y pégalo ahí. Dale a **Run**.
   Debe decir *Success*. Esto crea las tablas y la seguridad.
5. Ve a **Settings → API** y copia estos dos valores:
   - *Project URL*
   - *anon public* (la clave larga)
6. En la carpeta del proyecto, duplica el archivo `.env.example` y llámalo
   `.env`. Pega dentro los dos valores:

   ```
   VITE_SUPABASE_URL=https://loquesea.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

7. Crea las dos cuentas, la tuya y la de tu mujer, en **Authentication → Users →
   Add user** (marca *Auto Confirm User* para no tener que confirmar el email).
   La primera cuenta crea la casa; la segunda se une a ella sola.

8. **Importante, cuando ya estéis los dos registrados:** ve a **Authentication →
   Sign In / Providers** y desactiva *Allow new users to sign up*. Así nadie más
   puede crearse una cuenta en vuestra app.

Reinicia `npm run dev`. La app ya no dirá "modo de prueba": estará sincronizada.

### Paso 3 — Publicarla (Vercel, gratis)

1. Sube el proyecto a GitHub.
2. Entra en <https://vercel.com>, crea una cuenta con GitHub e importa el
   repositorio. Vercel detecta Vite solo, no hay que configurar nada.
3. En **Settings → Environment Variables** añade las dos mismas variables del
   `.env` (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
4. **Deploy**. Te dará una dirección tipo `nuestros-gastos.vercel.app`.

### Instalarla en el iPhone

1. Abre esa dirección **en Safari** (tiene que ser Safari, no Chrome).
2. Toca el botón de **Compartir** (el cuadrado con la flecha hacia arriba).
3. **Añadir a pantalla de inicio**.

Ya está: aparece el icono rojo y negro en la pantalla de inicio y se abre a pantalla
completa. Que haga lo mismo tu mujer en su iPhone.

---

## El día a día

- **Apuntar un gasto:** botón rojo **+** de abajo. Importe, categoría, listo.
- **Corregir o borrar:** toca cualquier gasto de la lista.
- **Importar el banco:** Ajustes → Importar. Vale el **Excel (.xlsx)** o el
  **CSV** que descargues del banco, tal cual. Antes de guardar nada verás la
  lista completa y podrás corregir categorías o quitar líneas. Los movimientos
  que ya tenías apuntados salen marcados como repetidos y desmarcados.

  Si tu banco solo da un **`.xls` antiguo** (formato de hace 20 años), ábrelo y
  guárdalo como `.xlsx` o CSV: la app te lo dirá con esas mismas palabras.
- **Gastos fijos:** Plan → Gastos fijos. Se apuntan solos el día del mes que
  les toque, incluso si lleváis semanas sin abrir la app. Un recibo del 31 cae
  el 28 en febrero: no se salta el mes.

  El botón **«Detectar los que ya se repiten»** busca en lo que importaste del
  banco lo que se paga todos los meses **por el mismo importe** y te lo propone
  con importe, día y categoría. Solo se crea lo que confirmes, y nunca duplica
  el histórico: los fijos empiezan a generarse a partir del mes siguiente al
  último que ya tenías. Al volver a importar del banco, el cargo real se detecta
  como repetido (mismo importe, fecha parecida) y sale desmarcado.

- **Categorías sueltas:** Ajustes → «Repasar los sin categoría» vuelve a pasar
  el categorizador por los gastos huérfanos. Útil después de corregir alguna
  categoría a mano, porque la app aprende de tus correcciones.

---

## Para quien toque el código

```bash
npm run dev       # servidor de desarrollo
npm test          # pruebas (importador de CSV, cálculos, formatos)
npm run build     # compilar para producción
npm run lint      # revisar el código
npm run iconos    # regenerar los iconos PNG de la app
```

### Cómo está montado

```
src/
  data/        Modelo de datos y acceso a la información
               repo.ts         · el contrato que usa toda la app
               localRepo.ts    · modo prueba (navegador)
               supabaseRepo.ts · modo compartido (nube)
  estado/      Tienda.tsx (estado global) y calculos.ts (resúmenes)
  lib/         Euros, fechas, lector de CSV y categorización automática
  componentes/ Piezas reutilizables (hoja, filas, gráficos)
  pantallas/   Una por pestaña
supabase/      esquema.sql — la base de datos entera
herramientas/  generar-iconos.mjs
```

Detalles que conviene no romper:

- **Los importes se guardan en céntimos** (enteros). Nunca en decimales: `0.1 +
  0.2` no da `0.3` en JavaScript y las cuentas dejarían de cuadrar.
- **La app nunca habla con Supabase directamente**, siempre a través de
  `data/repo.ts`. Por eso el modo de prueba y el modo nube comparten el mismo
  código de pantallas.
- **El tema es siempre oscuro**, a propósito: es una app que se abre veinte
  segundos para apuntar un gasto.
- **Las barras de los gráficos van todas del mismo rojo.** Lo que miden es
  cuánto, y eso lo dice su largo; quién es cada una lo dicen el emoji y el
  nombre escritos al lado. Los colores de categoría solo tiñen el icono, y están
  validados para distinguirse con daltonismo y contrastar sobre el negro.
- **La seguridad vive en la base de datos** (políticas RLS), no en la app. La
  clave `anon` es pública por diseño: sin sesión no deja ver nada.
