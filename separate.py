import nltk.data, re, os, json, math, numpy, string

def ping():
  redis_url = os.getenv('REDISTOGO_URL', 'redis://localhost:6379')
  os.system("ping "+str(redis_url))
  return 1