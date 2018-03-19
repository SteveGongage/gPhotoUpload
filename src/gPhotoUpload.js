// gPhotoUpload
// 		Purpose: provides scaling and image rotation to uploaded images
// 		Requires: jQuery, exif.js, and binaryajax.js to be loaded before this
// 		
// 		based off of ideas found here:
// 			http://code.hootsuite.com/html5/
// 			https://gamedev.stackexchange.com/questions/67274/is-it-possible-to-rotate-an-image-on-an-html5-canvas-without-rotating-the-whole
// 			http://creativejs.com/2012/01/day-10-drawing-rotated-images-into-canvas/
// 			
// 		Usage:
// 			// Assumes jQuery is loaded
//			<script src="/assets/plugins/exifjs/binaryajax.js"></script>
//			<script src="/assets/plugins/exifjs/exif.js"></script>
//			<script src="/assets/plugins/gJSTools/gPhotoUpload.js"></script>
// 		
// 			<input id="imageUp" name="imageData" type="file" accept="image/*">
// 			<script>
//				gPhotoUpload.init('imageUp', '/lib/kCompetition/cfml/uploadImage.cfm', {
//					"quality"		: .7
//					, "maxWidth"	: 800
//					, "maxHeight"	: 800
//					, "data"		: { "entryID": $scope.home._id.$oid, "entryLookup": $scope.home.lookup} 
//					, "onSuccess"	: function(message, results) { console.log('Upload Success ', results) }
//					, "onFailure"	: function(message, results) { console.warn('Upload Failure ', results) }
//				});
// 			</script>
// 		Options:
//			url
//			previewImg
//			fieldID
//			quality
//			maxWidth
//			maxHeight
//			onSuccess
//			onFailure
//			onSubmitFileStart
//			onSubmitFileEnd
//			formData





var gPhotoUpload = (function() {
	this.options = {};
	this.inputFieldID = '';
	this.url = '';
	this.imageProcessor	= '';
	this.inputField = null;

	//=======================================================
	this.init = function(o) {
		default_options = {
			'fileInput': null,	// required: <input type="file"> that triggers the file upload
			'url': null,		// optional: URL to submit the processed image to via AJAX
			'img': null,		// optional: img field to display the processed image
			'quality':  1,		// optional: resized quality from 0 to 1.  .8 is a good mix of compression and quality
			'maxWidth': null,	// optional: if resizing, set the maximum final width
			'maxHeight': null,  // optional: if resizing, set the maximum final height
			'formData': {},		// optional: any data to submit with the ajax request
			'onSuccess': function(message) { console.log('Submit Success', message)},			// run on submit success
			'onFailure':  function(message) { console.error('Submit Failure', message)},		// run on submit failure
			'onSubmitStart':  function(message) { console.log('On Submit Start', message)},		// run before submit starts
			'onSubmitEnd':  function(message) { console.log('On Submit End', message)}			// run after submit completes
		}

		this.options = Object.assign(default_options, o);


		// Handle Init Parameters and Options
		if (!this.options.fileInput || this.options.fileInput.length == 0)	{ 
			throw('Image input field is required.', this.options.fileInput)
		} else {
			this.inputField = $($('#'+ this.options.fileInput)[0]);
			if (!this.inputField) {
				throw('Image input field could not be found')
			}
		}

		// if (!postURL || postURL.length == 0)	{ throw('Post URL is not specified')}
		//imageProcessor = postURL;
		if (!this.options.url) { this.options.url = null }
		if (!this.options.quality || isNaN(this.options.quality) || this.options.quality < 0 || this.options.quality > 1) 	{ this.options.quality 	= 1 }
		if (!this.options.maxWidth) 	{ this.options.maxWidth 	= null }
		if (!this.options.maxHeight)	{ this.options.maxHeight	= null }
		if (!this.options.data)			{ this.options.data 		= {} }


		// Apply an event handler to the file input field specified
		if (window.File && window.FileReader && window.FormData) {
			this.inputField.on('change', function (e) {
				var file = e.target.files[0];

				if (file) {
					if (/^image\//i.test(file.type)) {
						readFile(file);
					} else {
						this.options.onFailure('Not a valid image!');
					}
				}
			});
		} else {
			this.options.onFailure("File upload is not supported by this browser!")
		}
	}


	//=======================================================
	function readFile(file) {
		var reader = new FileReader();

		reader.onloadend = function () {
			EXIF.getData(file, function() {
				processFile(reader.result, file.type, this.exifdata.Orientation);
			});
		}

		reader.onerror = function () {
			this.options.onFailure('There was an error reading the file!');
		}

		reader.readAsDataURL(file);
	}
	

	//=======================================================
	function processFile(dataURL, fileType, orientationNumber) {

		var image = new Image();
		image.src = dataURL;

		image.onload = function () {
			dataURL = resizeAndRotateImage(image, fileType, orientationNumber, options.quality);

			$('#imageShow')[0].src = dataURL;
			console.log($('#imageShow')[0]);

			sendFile(dataURL);
		};

		image.onerror = function () {
			options.onFailure('There was an error processing your file!');
		};
	}


	//=======================================================
	function sendFile(fileData) {
		var formData = new FormData();

		$.each(options.data, function(key, value) { 
			formData.append(key, value); 
		})

		formData.append('imageData', fileData);
		console.log(this.options);
		if (!this.options.url) {
			console.log('Image Submitting Disabled, no submit url was specified')
		} else {
			console.log('Submitting to ', this.options.url);

			options.onSubmitFileStart(formData)

			$.ajax({
				type		: 'POST',
				url			: this.options.url,
				data		: formData,
				contentType	: false,
				processData	: false,
				success		: function (results) {
				
					if (results.success) {
						options.onSuccess('Your file was successfully uploaded!', results);
					} else {
						options.onFailure('There was an error uploading your file.  Bad response received.', results);
					}
				},
				error: function (results) {
					options.onFailure('There was an error uploading your file!', results);
				}
			});

			options.onSubmitFileEnd(formData)
		}
		


	}


	//=======================================================

	var resizeAndRotateImage = function(img, fileType, orientation, quality) {
		console.log('Image Info: ', {"width": img.width, "height": img.height, "fileType": fileType, "orientation": orientation, "quality": quality});



		function resizeImage() {
			var maxWidth = this.options.maxWidth;
			var maxHeight = this.options.maxHeight;

			// If the max height/width is lower than the current height/width, resize this
			var shouldResize =  (!maxWidth && isNaN(maxWidth) && drawWidth > maxWidth) || 
								(!maxHeight && isNaN(maxHeight) && drawHeight > maxHeight);

			if (shouldResize) {
				if (imgCanvas.width > imgCanvas.height) {
					drawHeight		= imgCanvas.height * (maxWidth / imgCanvas.width);
					drawWidth		= maxWidth;
				} else {
					drawWidth		= imgCanvas.width * (maxHeight / imgCanvas.height);
					drawHeight		= maxHeight;
				}

				imgCanvas.width		= drawWidth;
				imgCanvas.height	= drawHeight;

				console.log('Resizing Performed - Current W:'+ drawWidth +' / H:'+ drawHeight +' - Max W:'+ maxWidth +' / H:'+ maxHeight);
			} else {
				console.log('Resizing not needed - Current W:'+ drawWidth +' / H:'+ drawHeight +' - Max W:'+ maxWidth +' / H:'+ maxHeight);
			}


		}

		function rotateImage() {
			roteateBy = 0
			switch (orientation) {
				case 1: rotateBy = 0; 	break;	// landscape 
				case 3: rotateBy = 180; break;	// landscape inverted
				case 6: rotateBy = 90; 	break;  // portrait 
				case 8: rotateBy = 270; break;  // portrait inverted
			}


			if (rotateBy == 90 || rotateBy == 270) {
				tempWidth			= imgCanvas.width;
				imgCanvas.width		= imgCanvas.height;
				imgCanvas.height	= tempWidth;
			}
		}

		//==============================

		var rotateBy = 0;
		var imgCanvas = document.createElement('canvas');

		// Quality should always be between 10% and 100%
		if (isNaN(quality) || !(quality <= .1 || quality > 1)) {
			quality = .8;
		}

		imgCanvas.width		= img.width; 
		drawWidth			= img.width;

		imgCanvas.height	= img.height; 
		drawHeight			= img.height;

		var context = imgCanvas.getContext('2d');
		context.save();

		resizeImage(img, imgCanvas, context);
		rotateImage(img, imgCanvas, context, rotateBy);

		var drawingInfo	= {	
			tw 		: imgCanvas.width / 2
			, th	: imgCanvas.height / 2
			, dx0	: -drawWidth / 2
			, dx1	: drawWidth
			, dy0	: -drawHeight / 2
			, dy1	: drawHeight
			, cw	: imgCanvas.width
			, ch 	: imgCanvas.height
			, iw 	: img.width
			, ih 	: img.height
			, rotate: rotateBy
		};

		context.translate(drawingInfo.tw, drawingInfo.th);

		if (rotateBy == 90 || rotateBy == 180 || rotateBy == 270) { 
			context.rotate(Math.PI / 180 * rotateBy); 
		}

		context.drawImage(img, drawingInfo.dx0, drawingInfo.dy0, drawingInfo.dx1, drawingInfo.dy1);
		context.restore(); 

		image_data = imgCanvas.toDataURL(fileType, quality);

		return image_data

	}


	return this
})()

