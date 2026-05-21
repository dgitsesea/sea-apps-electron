Para generar una nueva versión o actualización de los instalables:

​

Abir package.json e ir a la version actual y cambiar la que sea necesaria (ej. version 1.2.3), que será la version que se subirá a github para que se puedan actualizar las aplicaciones de los usuarios (Aplicaciones de escritorio).

​

En main, en la seccion de allowed origins se podrán agregar los sitios permitidos que se abriran dentro de la aplicación.

​

Para realizar los cambios en la rama main de github, poner una descripción y hacer el commit.

​

En la consola se deberá hacer : npm run build:all para generar el paquete de cada plataforma (win-mac-ubuntu).

​

Despues se deberá correr: npm run release, que será el que genera el repositorio en github con los nuevos instalables.

​

Para actualizar los enlaces de descarga de wordpress, se pueden copiar los enlaces que se generaron en releases de github para vincularlos y actualizarlos. En caso que un usuario ya tenga una antigua version, al abrir su app de escritorio detectará que hay una nueva version y le pedirá actualizarla. Esta se descarga de manera automática.

​
