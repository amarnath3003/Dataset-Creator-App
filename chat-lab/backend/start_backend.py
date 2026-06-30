import os

import uvicorn

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    # Port 8100 keeps Chat Lab clear of Finetune Lab (8000) and Dataset Lab.
    uvicorn.run("main:app", host="0.0.0.0", port=8100, reload=True)
