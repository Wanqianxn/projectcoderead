import nltk.data, re, os, json, math, numpy

from string import punctuation
from collections import Counter
from shutil import copyfile

# On accessing any webpage, cleanup all temporary folders created when the user uploaded files.
def cleanup():
    # Cleanup for uploads folder, used in all 4 apps.
    for filename in os.listdir('uploads'):
        if filename.startswith("input"):
            os.remove("uploads/"+filename)
    # Cleanup for Map.
    for filename in os.listdir('static/jsonobjects'):
        if filename.startswith("input"):
            os.remove("static/jsonobjects/"+filename)
    # Cleanup for Emotion. Note that the old colormap.js file is removed as a new one copied from a template.
    for filename in os.listdir('static/emotions'):
        if filename.startswith("bundle"):
            os.remove("static/emotions/"+filename)
    for filename in os.listdir('static/emotions/node_modules/colormap'):
        if filename.startswith("colorScale"):
            os.remove("static/emotions/node_modules/colormap/"+filename)
    copyfile('static/emotions/tcolorScales.js','static/emotions/node_modules/colormap/colorScales.js')

# Modifies uploaded file for Map for proper processing.
def modify():
    # Part I: Split into sentences
    input = open("uploads/input.txt","r")
    output = open("uploads/input1.txt", "w")

    tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
    data = input.read()
    output.write('\n-----\n'.join(tokenizer.tokenize(data)))

    input.close()
    output.close()
    
    # Part II: Split into lines
    input = open("uploads/input1.txt","r")
    output = open("uploads/input2.txt", "w")
    
    for line in input:
        line = line.strip("\n")
        if (line == "-----"):
            output.write("\n")
        else:
            output.write(line + " ")
            
    input.close()
    output.close()
    
    # Part III: Removing digits, numbers, some punctuation
    input = open("uploads/input2.txt","r")
    output = open("uploads/input3.txt", "w")
    
    for line in input:
        line = line.replace("--","\n")
        output.write(re.sub("\d+", "", line))
            
    input.close()
    output.close()
    
    # Part IV: Stopwords and punctuation removal
    filein1= open("static/stopwords.txt","r")
    filein2 = open("uploads/input3.txt","r")
    fileout = open("uploads/input4.txt", "w")

    sett = []
    for line in filein1:
        sett.append(line.strip("\n"))


    for linex in filein2:
        for word in linex.split():
            worda = word.lower()
            worda = ''.join(c for c in worda if c not in punctuation)
            if worda in sett:
                fileout.write("")
            else:
                fileout.write(worda + " ")
        fileout.write("\n")
        
    filein1.close()
    filein2.close()
    fileout.close()

    # Part V: Word frequency limit
    input = open("uploads/input4.txt","r")
    counter = Counter()

    for line in input:
        for word in line.split():
            counter[word] += 1
    input.close()

    input = open("uploads/input4.txt","r")
    output = open("uploads/inputfinal.txt", "w")

    for line in input:
        for word in line.split():
            if counter[word] > 19:
                output.write(word + " ")
        output.write("\n")
        
    input.close()
    output.close()
    
    # Delete unwanted files
    os.remove("uploads/input.txt")
    os.remove("uploads/input1.txt")
    os.remove("uploads/input2.txt")
    os.remove("uploads/input3.txt")
    os.remove("uploads/input4.txt")

# Create JSON object for graph visualization in Map.    
def network():
    # List out all words in file.
    input = open("uploads/inputfinal.txt","r")
    setofwords = set()
    dictsize = {}
    for line in input:
        for word in line.split():
            setofwords.add(word)
    for word in setofwords:
        dictsize[word] = {"sizee": 0}
    input.close()
    
    # Count frequency of each word in file, and creating list of all nodes.
    input = open("uploads/inputfinal.txt","r")
    for line in input:
        for word in line.split():
            dictsize[word]["sizee"] += 1
    nodes = []
    for word in setofwords:
        nodes.append({"id": word, "label": word, "x" : "0", "y" : "0", "size": dictsize[word]["sizee"]})
    input.close()

    # Create list of edges.
    edges = []
    input = open("uploads/inputfinal.txt","r")
    linearray = []
    count = 0

    for line in input:
        for i, word in enumerate(line.split()):
            linearray.append(word)
        for j in range(len(linearray)):
            for k in range(len(linearray)):
                if j < k and linearray[j] != linearray[k]:
                    if count > 0:
                        check = False
                        for m in range(count):
                            if (edges[m]["source"] == linearray[j] and edges[m]["target"] == linearray[k]) or (edges[m]["source"] == linearray[k] and edges[m]["target"] == linearray[j]):
                                edges[m]["size"] += 1
                                check = True
                            elif m == count-1 and check == False:
                                edges.append({"id": count, "source": linearray[j], "target": linearray[k], "size": 1, "type": "curve"})
                                count += 1
                    else:
                        edges.append({"id": count, "source": linearray[j], "target": linearray[k], "size": 1, "type": "curve"})
                        count += 1
        linearray = []
    input.close()

    # Only count edges with size over 5.
    edge2 = []
    for n in range(len(edges)):
        if edges[n]["size"] > 5:
            edge2.append(edges[n])

    # Input nodes and edges as a JSON object and sive into directory.
    edges = edge2
    jason = {"nodes": nodes, "edges": edges}
    output = open("static/jsonobjects/inputfinal.json", "w")
    output.write(json.dumps(jason))
    output.close()

# Modifies uploaded file for Emotion and Genre for proper processing.
def emodify():
    # Part I: Split into sentences
    input = open("uploads/input.txt","r")
    output = open("uploads/input1.txt", "w")
    tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
    data = input.read()
    output.write('\n-----\n'.join(tokenizer.tokenize(data)))
    input.close()
    output.close()
    
    # Part II: Split into lines
    input = open("uploads/input1.txt","r")
    output = open("uploads/input2.txt", "w")
    for line in input:
        line = line.strip("\n")
        if (line == "-----"):
            output.write("\n")
        else:
            output.write(line + " ")
    input.close()
    output.close()
    
    # Part III: Removing digits, numbers, some punctuation
    input = open("uploads/input2.txt","r")
    output = open("uploads/input3.txt", "w")
    
    for line in input:
        line = line.replace("--","\n")
        output.write(re.sub("\d+", "", line))
            
    input.close()
    output.close()
    
    # Part IV: Punctuation removal
    filein2 = open("uploads/input3.txt","r")
    fileout = open("uploads/inputfinal.txt", "w")
    for linex in filein2:
        for word in linex.split():
            worda = word.lower()
            worda = ''.join(c for c in worda if c not in punctuation)
            fileout.write(worda + " ")
        fileout.write("\n")
    filein2.close()
    fileout.close()

    # Delete unwanted files
    os.remove("uploads/input.txt")
    os.remove("uploads/input1.txt")
    os.remove("uploads/input2.txt")
    os.remove("uploads/input3.txt")
    
# Creates bundle.js Javascript file for colormap processing.
def spectrum():
    input = open("static/emolex.txt","r")

    # Create list + dict structure to store each word's emotional values from the "dictionary".
    emodic = {}
    count = 10
    for line in input:
        line = line.split()
        if count % 10 == 0:
            emodic[line[0]] = {
                'anger':	0, # Red
        	    'anticipation':	0, # Orange
        	    'disgust':	0, # Green
        	    'fear':	0, # Purple
        	    'joy':	0, # Yellow
        	    'negative':	0,
        	    'positive':	0,
        	    'sadness' : 0, # Blue
        	    'surprise':	0,
        	    'trust':	0 
            }
            emodic[line[0]][line[1]] = line[2]
            count += 1
        else:
            emodic[line[0]][line[1]] = line[2]
            count += 1

    input.close()
    
     
    rangeemot = ["anger","anticipation","joy","disgust","sadness","fear"]
    occurences = []
    # Everything below is iterated for all 6 emotions.
    # Open the text file and rewrite each word as "0" or "1" depending on emotional value.
    for emotion in rangeemot:
        input = open("uploads/inputfinal.txt","r")
        output = open("uploads/input"+emotion+".txt","w")
        for line in input:
            for word in line.split():
                if word in emodic:
                    if emodic[word][emotion] == '1':
                        output.write("1 ")
                    else:
                        output.write("0 ")
                else:
                    output.write("0 ")
            output.write("\n")
        input.close()
        output.close()
        
        # Count total number of words.
        input = open("uploads/input"+emotion+".txt","r")
        total = 0

        for line in input:
            for word in line.split():
                total += 1
        input.close()
        
        # Creation of JSON structure containing all the emotional words, as well as their position in the text (i.e. ratio of current count to total word count.)
        input = open("uploads/input"+emotion+".txt","r")
        output = open("static/emotions/node_modules/colormap/colorScales.js","a")
        emot = []
        countw = 0
        prev = 0
        divider = 0
        emot.append({"index": 0, "rgb": [0,0,0]})
        rainbow = {
            "anger":[255,0,0],
            "anticipation":[255,165,0],
            "joy":[255,255,0],
            "disgust":[0,255,0],
            "sadness":[0,0,255],
            "fear":[148,0,211]
            }

        for line in input:
            for word in line.split():
                countw += 1
                if word == "1":
                    divider = (0.007*math.log(total))*prev + (1-(0.007*math.log(total)))*(countw/total)
                    emot.append({"index": divider, "rgb": [0,0,0]})
                    emot.append({"index": countw/total, "rgb": rainbow[emotion]})
                    emot.append({"index": ((2*(countw/total)) - divider), "rgb": [0,0,0]})
                    prev = countw/total
            
        emot.append({"index": 1, "rgb": [0,0,0]})
        
        # Write JSON-like object.
        temp = json.dumps(emot)
        if emotion == "fear":
            output.write("\""+emotion+"\":"+temp+"\n"+"\n")
        else:
            output.write("\""+emotion+"\":"+temp+","+"\n"+"\n")
        input.close()
        output.close()
        occurences.append(int(((len(emot)-2)/3)))
    
    # Copy JSON-like object (necessary for Javascript visualization) to a file
    input = open("static/emotions/node_modules/colormap/colorScales.js","a")
    input.write("};")
    input.close()
    
    # Creation of bundle.js, which serves as the actual JS file for colormap generation.
    os.system("browserify static/emotions/main.js > static/emotions/bundle.js")
    return occurences

# Processing of uploaded file for Genre to plot onto bubble map.
def metrics():
    count = 0
    length = []
    pastcount = 0
    
    # Count: total word count, average sentence count as well as past tense/past participle count.
    input = open("uploads/inputfinal.txt", "r")
    for line in input:
        if line != "\n":
            sentence = 0
            for word in line.split():
                sentence += 1
                count += 1
                wordtype = nltk.pos_tag(word.split())[0][1]
                if wordtype == "VBD" or wordtype == "VBN":
                    pastcount += 1
            if sentence < 30 and sentence > 2: # Sentences too long or short are not counted, as they may have been processing erors by NLTK.
                length.append(sentence)
    input.close()
    
    # Calculate mean sentence length, sigma for standard lengths as well as shoe ratio.
    numpyarr = numpy.array(length)
    mean = numpy.mean(numpyarr, axis=0)
    sigma = numpy.std(numpyarr, axis=0)
    ratio = (pastcount/count)
    return (mean, sigma, ratio)

# RNN Code.
def write(name):
    data = open(name, 'r').read()
    chars = list(set(data))
    data_size, vocab_size = len(data), len(chars)
    char_to_ix = { ch:i for i,ch in enumerate(chars) }
    ix_to_char = { i:ch for i,ch in enumerate(chars) }

    # Hyper-paramters. These affect the speed at which the RNN generates iterations of text.
    hidden_size = 100
    seq_length = 25
    learning_rate = 1e-1
    
    Wxh = numpy.random.randn(hidden_size, vocab_size)*0.01
    Whh = numpy.random.randn(hidden_size, hidden_size)*0.01 
    Why = numpy.random.randn(vocab_size, hidden_size)*0.01 
    bh = numpy.zeros((hidden_size, 1)) 
    by = numpy.zeros((vocab_size, 1)) 
    
    def lossFun(inputs, targets, hprev):
      xs, hs, ys, ps = {}, {}, {}, {}
      hs[-1] = numpy.copy(hprev)
      loss = 0
      
      for t in range(len(inputs)):
        xs[t] = numpy.zeros((vocab_size,1)) 
        xs[t][inputs[t]] = 1
        hs[t] = numpy.tanh(numpy.dot(Wxh, xs[t]) + numpy.dot(Whh, hs[t-1]) + bh) 
        ys[t] = numpy.dot(Why, hs[t]) + by 
        ps[t] = numpy.exp(ys[t]) / numpy.sum(numpy.exp(ys[t])) 
        loss += -numpy.log(ps[t][targets[t],0]) #
        
      dWxh, dWhh, dWhy = numpy.zeros_like(Wxh), numpy.zeros_like(Whh), numpy.zeros_like(Why)
      dbh, dby = numpy.zeros_like(bh), numpy.zeros_like(by)
      dhnext = numpy.zeros_like(hs[0])
      for t in reversed(range(len(inputs))):
        dy = numpy.copy(ps[t])
        dy[targets[t]] -= 1 # 
        dWhy += numpy.dot(dy, hs[t].T)
        dby += dy
        dh = numpy.dot(Why.T, dy) + dhnext 
        dhraw = (1 - hs[t] * hs[t]) * dh 
        dbh += dhraw
        dWxh += numpy.dot(dhraw, xs[t].T)
        dWhh += numpy.dot(dhraw, hs[t-1].T)
        dhnext = numpy.dot(Whh.T, dhraw)
      for dparam in [dWxh, dWhh, dWhy, dbh, dby]:
        numpy.clip(dparam, -5, 5, out=dparam) 
      return loss, dWxh, dWhh, dWhy, dbh, dby, hs[len(inputs)-1]
    
    def sample(h, seed_ix, n):
      x = numpy.zeros((vocab_size, 1))
      x[seed_ix] = 1
      ixes = []
      for t in range(n):
        h = numpy.tanh(numpy.dot(Wxh, x) + numpy.dot(Whh, h) + bh)
        y = numpy.dot(Why, h) + by
        p = numpy.exp(y) / numpy.sum(numpy.exp(y))
        ix = numpy.random.choice(range(vocab_size), p=p.ravel())
        x = numpy.zeros((vocab_size, 1))
        x[ix] = 1
        ixes.append(ix)
      return ixes
    
    n, p = 0, 0
    mWxh, mWhh, mWhy = numpy.zeros_like(Wxh), numpy.zeros_like(Whh), numpy.zeros_like(Why)
    mbh, mby = numpy.zeros_like(bh), numpy.zeros_like(by)
    smooth_loss = -numpy.log(1.0/vocab_size)*seq_length 
    while True:
      if p+seq_length+1 >= len(data) or n == 0: 
        hprev = numpy.zeros((hidden_size,1)) 
        p = 0 
      inputs = [char_to_ix[ch] for ch in data[p:p+seq_length]]
      targets = [char_to_ix[ch] for ch in data[p+1:p+seq_length+1]]
    
      
      loss, dWxh, dWhh, dWhy, dbh, dby, hprev = lossFun(inputs, targets, hprev)
      smooth_loss = smooth_loss * 0.999 + loss * 0.001
     
      # Every 100 iterations, the results are printed out and compared to.
      if n % 100 == 0:
        sample_ix = sample(hprev, inputs[0], 200)
        txt = ''.join(ix_to_char[ix] for ix in sample_ix)
        if os.path.isdir('uploads') == True:
            writeout = open("uploads/inputtext.txt","w")
            writeout.write(txt)
            writeout.close()
        else:
            return 1
      
      for param, dparam, mem in zip([Wxh, Whh, Why, bh, by], 
                                    [dWxh, dWhh, dWhy, dbh, dby], 
                                    [mWxh, mWhh, mWhy, mbh, mby]):
        mem += dparam * dparam
        param += -learning_rate * dparam / numpy.sqrt(mem + 1e-8) 
    
      p += seq_length 
      n += 1 

# Obtain a list of all lines generated by the machine.
def obtain():
    input = open("uploads/inputtext.txt","r")
    contain = input.readlines()
    return contain
    