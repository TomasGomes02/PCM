'use strict';

class ISearchEngine {
    constructor(dbase) {
        this.allpictures = new Pool(3000);
        this.shownImages = []
        this.colors = ["red", "orange", "yellow", "green", "blue-green", "blue", "purple", "pink", "white", "grey", "black", "brown"];
        this.redColor   = [204, 251, 255, 0, 3, 0, 118, 255, 255, 153, 0, 136];
        this.greenColor = [0, 148, 255, 204, 192, 0, 44, 152, 255, 153, 0, 84];
        this.blueColor  = [0, 11, 0, 0, 198, 255, 167, 191, 255, 153, 0, 24];
        this.validsearches = ['beach', 'birthday', 'face', 'indoor', 'manmade/artificial', 'manmade/manmade', 'manmade/urban', 'marriage', 'nature', 'no_people', 'outdoor', 'party', 'people', 'snow']
        this.categories    = ["beach", "birthday", "face", "indoor", "manmade/artificial", "manmade/manmade","manmade/urban", "marriage", "nature", "no_people", "outdoor", "party", "people", "snow"];
        this.XML_file = dbase;
        this.XML_db = new XML_Database();
        this.LS_db = new LocalStorageXML();
        this.num_Images = 100;
        this.numshownpic = 35;
        this.imgWidth = 190;
        this.imgHeight = 140;
        this.lastSearches = [];
        this.memoryPos = -1;
        this.displayedImage = null;
        this.clickable = false;
        this.allImages = []
    }

    init(cnv) {
        this.databaseProcessing(cnv);
    }

    
    
    // method to build the database which is composed by all the pictures organized by the XML_Database file
    // At this initial stage, in order to evaluate the image algorithms, the method only compute one image.
    // However, after the initial stage the method must compute all the images in the XML file
    databaseProcessing (cnv) {
        let h12color = new ColorHistogram(this.redColor, this.greenColor, this.blueColor);
        let colmoments = new ColorMoments();

        for (let cat = 0 ; cat < this.categories.length ; cat++) {
            let xml    = this.XML_db.loadXMLfile(this.XML_file);
            let search = this.XML_db.SearchXML(this.categories[cat], xml, 1000);
            for (let img = 0 ; img < search.length ; img++){
                //ir buscar imagem a XML
                let imagem = new Picture(0, 0, 97, 97, search[img], this.categories[cat]); 
                //meter imagens em array
                this.allImages.push(imagem)
            }
        }

                
        if(this.categories.some(c => !localStorage.getItem(c))){
            this.buildLocalStorage(h12color, colmoments,cnv);
        }
        
    }

    buildLocalStorage(h12color,colmoments,cnv){

        for (let img = 0 ; img < this.allImages.length ; img++) {
                let imagem = this.allImages[img];
                let eventname = "processed_picture_" + imagem.impath;
                let eventP = new Event(eventname);
                let self = this;

                document.addEventListener(eventname, function(){
                    self.imageProcessed(imagem, eventname);
                },false);
                imagem.computation(cnv, h12color, colmoments, eventP);
        }

    }
    

    //When the event "processed_picture_" is enabled this method is called to check if all the images are
    //already processed. When all the images are processed, a database organized in XML is saved in the localStorage
    //to answer the queries related to Color and Image Example
    imageProcessed (img, eventname) {
        this.allpictures.insert(img);

        if (this.allpictures.stuff.length === (this.num_Images * this.categories.length)) {
            this.createXMLColordatabaseLS();
        }
    }

    //Method to create the XML database in the localStorage for color queries
    createXMLColordatabaseLS() {
        for (let cat = 0 ; cat < this.categories.length ; cat++){
            let coloredPictures = [];
            let entrada = "<images>";

            for (let img = 0 ; img < this.allpictures.stuff.length ; img++){
                if(this.allpictures.stuff[img].category === this.categories[cat]) coloredPictures.push(this.allpictures.stuff[img]);
            }
            for (let cor = 0 ; cor < this.colors.length ; cor++) {
                this.sortbyColor(cor, coloredPictures);
                for (let img = 0 ; img < 30 ; img++){
                    entrada += "<image class='" + this.colors[cor] + "'><path>" + coloredPictures[img].impath + "</path></image>"
                }
            }
            entrada += "</images>";
            this.LS_db.saveLS_XML(this.categories[cat], entrada);    
        } 
    }
    
    //Method to create the XML database in the localStorage for Image Example queries
    createXMLIExampledatabaseLS() {
    }

    //A good normalization of the data is very important to look for similar images. This method applies the
    // zscore normalization to the data
    zscoreNormalization() {
        let overall_mean = [];
        let overall_std = [];

        // Inicialization
        for (let i = 0; i < this.allpictures.stuff[0].color_moments.length; i++) {
            overall_mean.push(0);
            overall_std.push(0);
        }

        // Mean computation I
        for (let i = 0; i < this.allpictures.stuff.length; i++) {
            for (let j = 0; j < this.allpictures.stuff[0].color_moments.length; j++) {
                overall_mean[j] += this.allpictures.stuff[i].color_moments[j];
            }
        }

        // Mean computation II
        for (let i = 0; i < this.allpictures.stuff[0].color_moments.length; i++) {
            overall_mean[i] /= this.allpictures.stuff.length;
        }

        // STD computation I
        for (let i = 0; i < this.allpictures.stuff.length; i++) {
            for (let j = 0; j < this.allpictures.stuff[0].color_moments.length; j++) {
                overall_std[j] += Math.pow((this.allpictures.stuff[i].color_moments[j] - overall_mean[j]), 2);
            }
        }

        // STD computation II
        for (let i = 0; i < this.allpictures.stuff[0].color_moments.length; i++) {
            overall_std[i] = Math.sqrt(overall_std[i]/this.allpictures.stuff.length);
        }

        // zscore normalization
        for (let i = 0; i < this.allpictures.stuff.length; i++) {
            for (let j = 0; j < this.allpictures.stuff[0].color_moments.length; j++) {
                this.allpictures.stuff[i].color_moments[j] = (this.allpictures.stuff[i].color_moments[j] - overall_mean[j]) / overall_std[j];
            }
        }
    }

    
    writeKeyword(category){
        category = document.getElementById("text").value = category;
    }

    //Method to search images based on a selected color
    searchColor(category, color) {
        if (category === 'search') {
            category = document.getElementById("text").value;
            if (!this.validsearches.includes(category.toLowerCase())) return;
            category = this.categories[this.validsearches.indexOf(category.toLowerCase())]
        } 
    
        //obter elementos do XML com color escolhida
        let search = this.LS_db.readLS_XML(category);

        
        let matchingColor = search.getElementsByClassName(color);

        
        this.shownImages = [];

        //path imagem 0
        //console.log(matchingColor[0].textContent);

        //correr array de elementos da cor escolhida
        for(let i = 0; i < matchingColor.length; i++){
            //correr array de imagens 
            for(let j = 0; j < this.allImages.length; j++){
                //selecionar imagens por path que está no array de elementos da cor escolhida
                if(this.allImages[j].impath === matchingColor[i].textContent){
                    let img = this.allImages[j];
                    this.shownImages.push(img)
                    break;
                }
            }

        }

        let canvas = document.querySelector("canvas");
        this.gridView(canvas);
    }
    
    //Method to search images based on keywords
    searchKeywords(category) {

        //ignorar categoria search
        if(category!='search'){
            this.writeKeyword(category);
        }

        if (category === 'search') {
            category = document.getElementById("text").value;
            if (!this.validsearches.includes(category.toLowerCase())) return;
            category = this.categories[this.validsearches.indexOf(category.toLowerCase())]
        } 
        this.shownImages = [];
  
        //copiar array de todas as imagens e filtrar por categoria
        this.allImages_search = [...this.allImages].filter(a => a.category === category)
        //organizar de forma aleatoria imagens
        this.allImages_search.sort(() => Math.random() - 0.5)

        for (let i = 0 ; i < 30 ; i++){     
                let img = this.allImages_search[i];   
                this.shownImages.push(img);
        }

        let canvas = document.querySelector("canvas");
        
        this.gridView(canvas);
    }

    //Method to search images based on Image similarities
    searchISimilarity(IExample, dist) {
        

    }

    //Method to compute the Manhattan difference between 2 images which is one way of measure the similarity
    //between images.
    calcManhattanDist(img1, img2){
       
    }

    //Method to sort images according to the Manhattan distance measure
    sortbyManhattanDist(idxdist,list){
        list.sort(function (a, b) {
            return a.dist - b.dist;
        });
    }

    //Method to sort images according to the number of pixels of a selected color
    sortbyColor (idxColor, list) {
        list.sort(function (a, b) {
            return b.hist[idxColor] - a.hist[idxColor];
        });
    }

    searchSimilar(){
    }

    gridView(canvas) {
        
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, 1300, 1300); 
        
        var radius = 500;
        
        var angleIncrement = (2 * Math.PI) / 15;
        for (var i = 0; i < 15; i++) {

            let image = this.shownImages[i];
            var angle = i * angleIncrement - Math.PI/2;
            var x = 650 + radius/1.5 * Math.cos(angle);
            var y = 650 + radius/1.5 * Math.sin(angle);
            
            image.setPosition(x - image.w / 2, y - image.h / 2);
            image.draw(canvas);
            
        }

        for (var i = 0; i < 15; i++) {
            
            let image = this.shownImages[i+15];
            var angle = i * angleIncrement - Math.PI/2;
            var x = 650 + radius * Math.cos(angle);
            var y = 650 + radius * Math.sin(angle);
            
            image.setPosition(x - image.w / 2, y - image.h / 2);
            image.draw(canvas);
            
        }
    }


}

class Pool {
    constructor (maxSize) {
        this.size = maxSize;
        this.stuff = [];

    }

    insert (obj) {
        if (this.stuff.length < this.size) {
            this.stuff.push(obj);
        } else {
            alert("The application is full: there isn't more memory space to include objects");
        }
    }

    remove () {
        if (this.stuff.length !== 0) {
            this.stuff.pop();
        } else {
           alert("There aren't objects in the application to delete");
        }
    }

    empty_Pool () {
        while (this.stuff.length > 0) {
            this.remove();
        }
    }
}

