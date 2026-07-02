VOCAB = [
    "2", "3", "4", "5", "6", "7", "8", "9",
    "A", "B", "C", "D", "E", "F", "G", "H",
    "J", "K", "M", "N", "P", "Q", "R", "S",
    "T", "U", "V", "W", "X", "Y", "Z",
]
IDX_TO_CHAR = {i: ch for i, ch in enumerate(VOCAB)}

def decode_predictions(preds: list[int]) -> str:
    """Decode class indices to characters."""
    return "".join(IDX_TO_CHAR[idx] for idx in preds)
