var checkout = {};

$(document).ready(function() {

    $('#blah').hide()

    // AWS SDK Variables
    // var albumBucketName = "coms6998-sp21-photobucket";
    var albumBucketName = "index-photos-bucket-b2";
    var bucketRegion = "us-east-1";
    var IdentityPoolId= "us-east-1:bcdf8d8b-dd78-46c4-afd9-05bfc9139e4e";

    // *******************************************
    // Part 1: Upload photos 
    // *******************************************


        // **********************
        // Retrieving uploaded image:
        // **********************

    // Get uploaded file
    const inputElement = document.getElementById("myFile");
    inputElement.addEventListener("change", handleFiles, false);
    photofile = null
    function handleFiles() {
        const fileList = this.files; /* now you can work with the file list */
        var reader = new FileReader();

        reader.onload = function (e) {
            $('#blah')
                .attr('src', e.target.result)
                .width($(window).width() * .15)
                .show();
                // .height(180);
            // document.getElementById("blah").style.display = "initial";
            
        };

        reader.readAsDataURL(fileList[0]);
        photofile = reader.result
        console.log(fileList[0].name)
        console.log(atob(photofile))
    }

        // **********************
        // Caption generation
        // **********************

    // Display captions already inputted
    document.getElementById("submitlabels").onclick = function() {
        console.log("activated!")
        //First things first, we need our text:
        var text = document.getElementById("input_labels").value; //.value gets input values
    
        //Now construct a quick list element
        var list_item = document.createElement('li'); // is a node
        list_item.innerHTML = text;
    
        //Now use appendChild and add it to the list!
        document.getElementById("list").appendChild(list_item);
    }


        // **********************
        // Upload to S3
        // **********************

    // Package captions and submit to API Gateway
    document.getElementById("submitphoto").onclick = function() {
        // Grab photo
        photo = document.getElementById("myFile").files[0]
        filename = photo.name
        console.log("You uploaded file name" + photo.name)
        var reader = new FileReader()
        processed_photo = reader.readAsDataURL(photo)
        processed_photo = reader.result

        // reader.readAsDataURL(fileList[0]);
        label = ''
        list = document.getElementById("list").getElementsByTagName('li');
        for(var i=0;i < list.length; i++) {
            // var arrValue = list[i].innerHTML;
            // alert(arrValue);
            // console.log(typeof list[i].innerText)
            // console.log(typeof list[i].innerText.toString())
            label = label + list[i].innerText.toString() + ' '
            // labels.push(list[i].innerText.toString());
        }
        // label = label
        // console.log(labels)
        console.log(label)

        // Package as header and send to aws below
        // upload_to_AWS(photo, labels, filename)

        // Use S3 ManagedUpload class as it supports multipart uploads
        
        var albumBucketName = "index-photos-bucket-b2";
        // var albumBucketName = "";
        var bucketRegion = "us-east-1";
        var IdentityPoolId = "us-east-1:3ae2d6e8-7a05-4b58-8d3a-0209b5a095f0";
        // var IdentityPoolId= "us-east-1:bcdf8d8b-dd78-46c4-afd9-05bfc9139e4e";

        AWS.config.update({
            region: bucketRegion,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: IdentityPoolId
            })
        });

        var s3 = new AWS.S3({
            apiVersion: "2006-03-01",
            params: { Bucket: albumBucketName }
        });
        // labels = "String test?"
        // console.log(labels)
        // labels = ["Sup", "test"]
        // metadata = {customLabels: "hi"}
        var upload = new AWS.S3.ManagedUpload({
            params: {
                Bucket: albumBucketName,
                Key: filename,
                Body: photo,
                Metadata: {customLabels: label.trim()},
            },
        });

        var promise = upload.promise();

        promise.then(
            function(data) {
                alert("Successfully uploaded photo.");
                    viewAlbum(albumName);
                    },
                function(err) {
                return alert("There was an error uploading your photo: ", err.message);
            }
        );
    }

    // *******************************************
    // Part 2: Search photos 
    // *******************************************

        // **********************
        // Search by speech:
        // **********************

    var recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
 
    var speech = []
    var diagnostic = document.querySelector('.output');
    recognition.onnomatch = function(event) {
        diagnostic.textContent = 'I didnt recognize that color.';
      }
    recognition.onerror = function(event) {
        diagnostic.textContent = 'Error occurred in recognition: ' + event.error;
      }

    document.getElementById("Start").onclick = function(){
        recognition.start()
    }

    document.getElementById("Stop").onclick = function(){
        recognition.stop()
    }

    recognition.onspeechend = function() {
        recognition.stop();
        console.log(speech[speech.length-1])
        extracted_text = speech[speech.length-1]
        //Now construct a quick list element
        var list_item = document.createElement('li'); // is a node
        list_item.innerHTML = extracted_text;
        document.getElementById("transcribed_speech").appendChild(list_item);
    }

    recognition.onresult = function(event) {
        speech.push(event["results"][0][0]["transcript"])
        // console.log(event["results"][0][0]["transcript"])
    }

    // document.getElementById("Stop").onclick = function(){
    //     console.log("Ended recording")
    //     mediaRecorder.stop()
    // }

    // Handle Speech Search
    document.getElementById("submitspeech").onclick = function() {
        extracted_text = speech[speech.length-1]
        search_from_AWS(extracted_text)
    }

        // **********************
        // Search by text:
        // **********************

    // Handle Text Search
    document.getElementById("submitsearch").onclick = function() {
        extracted_text = document.getElementById("search_terms").value
        // alt_search_from_AWS(extracted_text)
        search_from_AWS(extracted_text)
    }

    // *******************************************
    // Helper Functions:
    // *******************************************

    // Main Driver for uploading to AWS
    function upload_to_AWS(photo, labels, filename){
        // TODO:
        console.log(photo)
        bucket = albumBucketName;
        response = sdk.uploadPut({Accept:"*/*", "Content-Type":"image/jpg", labels:labels, item:filename},{
            body:photo
        },{})
        console.log("Response from API Gateway:" + response)
    }

    // Driver for searching from AWS
    function search_from_AWS(extracted_text){
        console.log("About to send speech off: " + extracted_text)
        // TODO: Format properly
        response = sdk.searchGet({q:extracted_text},{
            body:extracted_text
        },{})
        console.log("Response from API Gateway:")
        response.then(function(result) {
            labels = result["data"]["Links"]
            if (labels.length == 0){
                $("#ResultsSection").html('Sorry, no results found for this search...')
            }
            else {
                $("#ResultsSection").html('')
                for(var i=0;i < labels.length; i++) {
                    // var arrValue = list[i].innerHTML;
                    // alert(arrValue);
                    console.log(labels[i])
                    appendImage(labels[i])
                }
            }
         })
    }
        
    // Driver for searching from AWS
    function alt_search_from_AWS(extracted_text){
        AWS.config.update({
            region: bucketRegion,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: IdentityPoolId
            })
        });

        var lambda = new AWS.Lambda({
            apiVersion: '2015-03-31',
        });
        payload = JSON.stringify({ "queryStringParameters":{ "q":extracted_text,},})
        var params = {
            FunctionName: "A2-LF2-search-photos", 
            InvocationType: "RequestResponse", 
            Payload: payload, 
           };
        promise = lambda.invoke(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else     console.log(data);           // successful response
            /*
            data = {
             Payload: <Binary String>, 
             StatusCode: 200
            }
            */
          }).promise();
        
        // This is to test that CodePipeline works

        // var promise = invocation.promise();

        promise.then(
            // console.log(res)
            function(data) {
                alert("Got some results back from lambda");
                    console.log(data);
                    },
                function(err) {
                return alert("There was in invoking LF2 Lambda: ", err.message);
            }
        );
        
    }

    // Helper for extracting search results returned from API Gateway
    // appendImage("https://coms6998-sp21-photobucket.s3.amazonaws.com/img004.jpg")
    function appendImage(photo){
        var img = $('<img />'); //Equivalent: $(document.createElement('img'))
        img.attr('src', photo);
        img.appendTo('#ResultsSection');
    }
});

//   $(window).load(function() {
//     $messages.mCustomScrollbar();
//     insertResponseMessage('Hi there, I\'m your personal Concierge. How can I help?');
//   });

//   function updateScrollbar() {
//     $messages.mCustomScrollbar("update").mCustomScrollbar('scrollTo', 'bottom', {
//       scrollInertia: 10,
//       timeout: 0
//     });
//   }

//   function setDate() {
//     d = new Date()
//     if (m != d.getMinutes()) {
//       m = d.getMinutes();
//       $('<div class="timestamp">' + d.getHours() + ':' + m + '</div>').appendTo($('.message:last'));
//     }
//   }


//   $('.message-submit').click(function() {
//     insertMessage();
//   });

//   $(window).on('keydown', function(e) {
//     if (e.which == 13) {
//       insertMessage();
//       return false;
//     }
//   })

//   function insertResponseMessage(content) {
//     $('<div class="message loading new"><figure class="avatar"><img src="https://media.tenor.com/images/4c347ea7198af12fd0a66790515f958f/tenor.gif" /></figure><span></span></div>').appendTo($('.mCSB_container'));
//     updateScrollbar();

//     setTimeout(function() {
//       $('.message.loading').remove();
//       $('<div class="message new"><figure class="avatar"><img src="https://media.tenor.com/images/4c347ea7198af12fd0a66790515f958f/tenor.gif" /></figure>' + content + '</div>').appendTo($('.mCSB_container')).addClass('new');
//       setDate();
//       updateScrollbar();
//       i++;
//     }, 500);
//   }


