from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import uvicorn

app = FastAPI()


@app.get('/coi-serviceworker.js')
def serviceworker():
    return FileResponse('./docs/coi-serviceworker.js', media_type='application/javascript')


"""
def fib(n):
    for _ in range(n):
        pass
    print('end')

fib(10**7)
"""
app.mount("/", StaticFiles(directory="docs"), name="static")

if __name__ == '__main__':
    os.system('python create_html.py')
    uvicorn.run(app, host="0.0.0.0", port=8888)
