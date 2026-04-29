import sys
sys.path.insert(0, '/usr/lib/python3/dist-packages')

from app.main import app
import uvicorn

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000, reload=True)
