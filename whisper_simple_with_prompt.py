import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
import librosa  # Add librosa for audio loading
import datetime


medical_prompt = """This radiological analysis discusses thoracic imaging findings 
including pleural effusions, pulmonary nodules, and mediastinal abnormalities."""

mp3_file = "/mnt/d/medical_health_analysis/radiology_videos/All_you_need_to_know_to_interpret_a_chest_radiograph_-_Session_3_LS24KKRlSLc/All_you_need_to_know_to_interpret_a_chest_radiograph_-_Session_3.mp3"

# Set device and dtype
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
print(f"Using device: {device}")
print(f"Using torch dtype: {torch_dtype}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA device name: {torch.cuda.get_device_name(0)}")
    print(f"CUDA memory allocated: {torch.cuda.memory_allocated(0) / 1024**2:.2f} MB")

# Load model and processor
model = AutoModelForSpeechSeq2Seq.from_pretrained(
    "Crystalcareai/Whisper-Medicalv1", 
    torch_dtype=torch_dtype,
    use_safetensors=True
)
model.to(device)

huggingface_model_name = "Crystalcareai/Whisper-Medicalv1"
huggingface_model_name = "Na0s/Medical-Whisper-Large-v3"
# Load model directly

processor = AutoProcessor.from_pretrained(huggingface_model_name)

# Your medical prompt
radiology_prompt = """The following is a radiology lecture discussing chest radiographs, 
medical conditions, imaging findings, and patient diagnoses. The speaker uses medical terminology 
including anatomical structures, pathological conditions, and diagnostic procedures."""

radiology_prompt = """The following is a radiology lecture discussing chest radiographs, 
medical conditions, imaging findings, and patient diagnoses. The speaker uses medical terminology 
including anatomical structures, pathological conditions, and diagnostic procedures. 
Choose the medical term for near homonyms "mediastinum" not "Mediastino", "fainting spells" not "painting spells", and look for words like imaging findings like bilateral infiltrates, pneumothorax, effusion, cardiomegaly, hilar lymphadenopathy,
pulmonary edema, consolidation, atelectasis, etc."""

# Process audio - first load the audio file using librosa
print(f"Loading audio file: {mp3_file}")
audio_array, sampling_rate = librosa.load(mp3_file, sr=16000)
print(f"Audio loaded successfully. Length: {len(audio_array)}, Sampling rate: {sampling_rate}")

# Use the processor to extract features - IMPORTANT: match the dtype with model
audio_features = processor.feature_extractor(
    audio_array,
    sampling_rate=sampling_rate,
    return_tensors="pt"
).input_features

# Convert to the same dtype as the model and move to the correct device
audio_features = audio_features.to(device=device, dtype=torch_dtype)
print(f"Audio processed. Shape: {audio_features.shape}, Type: {audio_features.dtype}")

# Get prompt IDs but don't force them in the config to avoid conflicts
prompt_ids = processor.get_prompt_ids(radiology_prompt, return_tensors="pt").to(device)
print(f"Prompt created with shape: {prompt_ids.shape}")

# Set up a pipeline for chunked processing
asr_pipeline = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    chunk_length_s=30,  # Process 30 seconds at a time
    stride_length_s=[5, 5],  # Overlap between chunks to ensure continuity
    device=device,
    torch_dtype=torch_dtype
)

# Process the whole file with chunking
full_transcription = asr_pipeline(
    audio_array,
    generate_kwargs={
        "task": "transcribe",
        "prompt_ids": prompt_ids
    },
    return_timestamps=True
)

print("Full transcription result:")
print(full_transcription)
now = datetime.now().strftime("%Y%m%d_%H%M%S")
output_file_path = "transcription" + huggingface_model_name + now + ".txt"
save_transcription_to_file(full_transcription, output_file_path)
