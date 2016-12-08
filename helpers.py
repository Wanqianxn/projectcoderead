import nltk.data, re, os, json, math, numpy

from string import punctuation
from collections import Counter
from shutil import copyfile

def cleanup():
    # Cleanup for uploads folder.
    for filename in os.listdir('uploads'):
        if filename.startswith("input"):
            os.remove("uploads/"+filename)
    # Cleanup for Map.
    for filename in os.listdir('static/jsonobjects'):
        if filename.startswith("input"):
            os.remove("static/jsonobjects/"+filename)
    # Cleanup for Emotion.
    for filename in os.listdir('static/emotions'):
        if filename.startswith("bundle"):
            os.remove("static/emotions/"+filename)
    for filename in os.listdir('static/emotions/node_modules/colormap'):
        if filename.startswith("colorScale"):
            os.remove("static/emotions/node_modules/colormap/"+filename)
    copyfile('static/emotions/tcolorScales.js','static/emotions/node_modules/colormap/colorScales.js')

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
        line = line.replace("’s","")
        line = line.replace("’","")
        line = line.replace("”","")
        line = line.replace("“","")
        output.write(re.sub("\d+", "", line))
            
    input.close()
    output.close()
    
    # Part IV: Stopword and punctuation removal
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
    
def network():
    input = open("uploads/inputfinal.txt","r")

    setofwords = set()
    dictsize = {}

    for line in input:
        for word in line.split():
            setofwords.add(word)

    for word in setofwords:
        dictsize[word] = {"sizee": 0}

    input.close()
    
    input = open("uploads/inputfinal.txt","r")

    for line in input:
        for word in line.split():
            dictsize[word]["sizee"] += 1

    nodes = []

    for word in setofwords:
        nodes.append({"id": word, "label": word, "x" : "0", "y" : "0", "size": dictsize[word]["sizee"]})

    input.close()

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

    edge2 = []
    for n in range(len(edges)):
        if edges[n]["size"] > 5:
            edge2.append(edges[n])

    edges = edge2

    jason = {"nodes": nodes, "edges": edges}
    output = open("static/jsonobjects/inputfinal.json", "w")
    output.write(json.dumps(jason))
    output.close()
    
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
        line = line.replace("’s","")
        line = line.replace("’","")
        line = line.replace("”","")
        line = line.replace("“","")
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
    
def spectrum():
    input = open("static/emolex.txt","r")

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
        
        input = open("uploads/input"+emotion+".txt","r")
        total = 0

        for line in input:
            for word in line.split():
                total += 1
        input.close()
        
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
        temp = json.dumps(emot)
        if emotion == "fear":
            output.write("\""+emotion+"\":"+temp+"\n"+"\n")
        else:
            output.write("\""+emotion+"\":"+temp+","+"\n"+"\n")
        input.close()
        output.close()
        occurences.append(int(((len(emot)-2)/3)))
        
    input = open("static/emotions/node_modules/colormap/colorScales.js","a")
    input.write("};")
    input.close()
    
    os.system("browserify static/emotions/main.js > static/emotions/bundle.js")
    return occurences
    
def gmodify():
    input = open("uploads/input.txt","r")
    output = open("uploads/input1.txt", "w")
    tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
    data = input.read()
    output.write('\n-----\n'.join(tokenizer.tokenize(data)))
    input.close()
    output.close()

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
    
    input = open("uploads/input2.txt","r")
    output = open("uploads/input3.txt", "w")
    for line in input:
        line = line.replace("--","\n")
        line = line.replace("’","")
        line = line.replace("”","")
        line = line.replace("“","")
        output.write(re.sub("\d+", " ", line))
    input.close()
    output.close()
    
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
    
    os.remove("uploads/input.txt")
    os.remove("uploads/input1.txt")
    os.remove("uploads/input2.txt")
    os.remove("uploads/input3.txt")
        
def metrics():
    count = 0
    length = []
    pastcount = 0
    
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
            if sentence < 30 and sentence > 2:
                length.append(sentence)
    input.close()
    
    numpyarr = numpy.array(length)
    mean = numpy.mean(numpyarr, axis=0)
    sigma = numpy.std(numpyarr, axis=0)
    ratio = (pastcount/count)
    
    return (mean, sigma, ratio)
    
def write(name):
    data = open(name, 'r').read() # should be simple plain text file
    chars = list(set(data))
    data_size, vocab_size = len(data), len(chars)
    char_to_ix = { ch:i for i,ch in enumerate(chars) }
    ix_to_char = { i:ch for i,ch in enumerate(chars) }

    # hyperparameters
    hidden_size = 100 # size of hidden layer of neurons
    seq_length = 25 # number of steps to unroll the RNN for
    learning_rate = 1e-1
    
    # model parameters
    Wxh = numpy.random.randn(hidden_size, vocab_size)*0.01 # input to hidden
    Whh = numpy.random.randn(hidden_size, hidden_size)*0.01 # hidden to hidden
    Why = numpy.random.randn(vocab_size, hidden_size)*0.01 # hidden to output
    bh = numpy.zeros((hidden_size, 1)) # hidden bias
    by = numpy.zeros((vocab_size, 1)) # output bias
    
    def lossFun(inputs, targets, hprev):
      xs, hs, ys, ps = {}, {}, {}, {}
      hs[-1] = numpy.copy(hprev)
      loss = 0
      
      # forward pass
      for t in range(len(inputs)):
        xs[t] = numpy.zeros((vocab_size,1)) # encode in 1-of-k representation
        xs[t][inputs[t]] = 1
        hs[t] = numpy.tanh(numpy.dot(Wxh, xs[t]) + numpy.dot(Whh, hs[t-1]) + bh) # hidden state
        ys[t] = numpy.dot(Why, hs[t]) + by # unnormalized log probabilities for next chars
        ps[t] = numpy.exp(ys[t]) / numpy.sum(numpy.exp(ys[t])) # probabilities for next chars
        loss += -numpy.log(ps[t][targets[t],0]) # softmax (cross-entropy loss)
        
      # backward pass: compute gradients going backwards
      dWxh, dWhh, dWhy = numpy.zeros_like(Wxh), numpy.zeros_like(Whh), numpy.zeros_like(Why)
      dbh, dby = numpy.zeros_like(bh), numpy.zeros_like(by)
      dhnext = numpy.zeros_like(hs[0])
      for t in reversed(range(len(inputs))):
        dy = numpy.copy(ps[t])
        dy[targets[t]] -= 1 # backprop into y. see http://cs231n.github.io/neural-networks-case-study/#grad if confused here
        dWhy += numpy.dot(dy, hs[t].T)
        dby += dy
        dh = numpy.dot(Why.T, dy) + dhnext # backprop into h
        dhraw = (1 - hs[t] * hs[t]) * dh # backprop through tanh nonlinearity
        dbh += dhraw
        dWxh += numpy.dot(dhraw, xs[t].T)
        dWhh += numpy.dot(dhraw, hs[t-1].T)
        dhnext = numpy.dot(Whh.T, dhraw)
      for dparam in [dWxh, dWhh, dWhy, dbh, dby]:
        numpy.clip(dparam, -5, 5, out=dparam) # clip to mitigate exploding gradients
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
    mbh, mby = numpy.zeros_like(bh), numpy.zeros_like(by) # memory variables for Adagrad
    smooth_loss = -numpy.log(1.0/vocab_size)*seq_length # loss at iteration 0
    while True:
      # prepare inputs (we're sweeping from left to right in steps seq_length long)
      if p+seq_length+1 >= len(data) or n == 0: 
        hprev = numpy.zeros((hidden_size,1)) # reset RNN memory
        p = 0 # go from start of data
      inputs = [char_to_ix[ch] for ch in data[p:p+seq_length]]
      targets = [char_to_ix[ch] for ch in data[p+1:p+seq_length+1]]
    
      # forward seq_length characters through the net and fetch gradient
      loss, dWxh, dWhh, dWhy, dbh, dby, hprev = lossFun(inputs, targets, hprev)
      smooth_loss = smooth_loss * 0.999 + loss * 0.001
      #if n % 100 == 0: print ("iter "+str(n)+", loss: "+str(smooth_loss)) # print progress
      
      # sample from the model now and then
      if n % 100 == 0:
        sample_ix = sample(hprev, inputs[0], 200)
        txt = ''.join(ix_to_char[ix] for ix in sample_ix)
        writeout = open("uploads/inputtext.txt","w")
        writeout.write(txt)
        writeout.close()
      
      # perform parameter update with Adagrad
      for param, dparam, mem in zip([Wxh, Whh, Why, bh, by], 
                                    [dWxh, dWhh, dWhy, dbh, dby], 
                                    [mWxh, mWhh, mWhy, mbh, mby]):
        mem += dparam * dparam
        param += -learning_rate * dparam / numpy.sqrt(mem + 1e-8) # adagrad update
    
      p += seq_length # move data pointer
      n += 1 # iteration counter 

def obtain():
    input = open("uploads/inputtext.txt","r")
    contain = input.readlines()
    return contain
    