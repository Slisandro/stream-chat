# Stream Chat

Deploy in Fly.io

## Deploy 

Para realizar el deploy se debe ejecutar 

```
fly deploy # Con los cambios ya subidos
```

## Restaurar base de datos 

Conectarse a la consola con SSH 

```
fly ssh console -a [PROJECT_NAME]

cd app/data

ls -la # Verificar que existe la db (archivo .db)

rm -rf *

exit
```

