# Fraud Message Detector (Thai)

A web application that detects Thai scam/fraud messages using a fine-tuned **WangchanBERTa** model.
Paste a suspicious message, and the app estimates its risk level, highlights warning signals, and suggests what to do next.

🤗 Model on Hugging Face: [P1g/fraud-message-detector-model](https://huggingface.co/P1g/fraud-message-detector-model)


## Features

- **Message checking** — classifies a Thai message as normal or scam, with a risk level
- **Warning signals & recommendations** — explains why a message looks risky, with recommended actions based on the message
- **User accounts** — sign up / log in with password
- **Check history** — each user's recent checks
- **Personal risk trend** — share of risky messages over time (1 week – 1 year)
- **"รับมือเมื่อถูกหลอก" page** — steps to take after being scammed, based on official Thai government sources
- **Help / criteria page**, light & dark theme

## Model Performance

Evaluated on a test set of 269 messages (142 scam, 127 normal).

| Metric | Score |
|--------|-------|
| **F2 (primary metric)** | **91.9%** |
| Recall | 90.8% |
| Precision | 96.3% |
| F1 | 93.5% |
| Accuracy | 93.3% |

F2 is the primary metric because missing a scam message is more costly than flagging a normal one.

## Tech Stack

| Part | Technology |
|------|------------|
| Model | WangchanBERTa (fine-tuned), Hugging Face Transformers, PyTorch |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Frontend | HTML, CSS, JavaScript |

## Project Structure

```
backend/
  main.py           # FastAPI app & API routes
  auth.py           # login / authentication
  config.py         # settings
  model_utils.py    # model loading & prediction
  explain_utils.py  # warning signals & recommendations
  requirements.txt
frontend/           # HTML / CSS / JS pages
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rachatamj/fraud-message-detector.git
cd fraud-message-detector
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in `backend/`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 4. Run

```bash
uvicorn main:app --reload
```

The model is downloaded automatically from Hugging Face on the first run.


## Dataset

The training data includes a study dataset from Rangsit University ([source](https://github.com/0-Mini-Peak-1/Thai-SMS-Scam-Spam-OTP-Dataset)), together with additional messages prepared for this project.
The full training dataset is not included in this repository.

## Limitations

- May misclassify new scam patterns not seen in the training data.
- Intended as a warning tool — not a replacement for careful judgment.

## Credits

- Base model: [WangchanBERTa](https://huggingface.co/airesearch/wangchanberta-base-att-spm-uncased) by VISTEC-AI ([thai2transformers](https://github.com/vistec-AI/thai2transformers), Apache-2.0)
- Dataset: Rangsit University ([source](https://github.com/0-Mini-Peak-1/Thai-SMS-Scam-Spam-OTP-Dataset))


