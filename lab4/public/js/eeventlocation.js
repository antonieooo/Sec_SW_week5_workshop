
let mapOptions = {
    center:[51.5073219, -0.1276474],
    zoom:15
}

let ws_map = new L.map('map' , mapOptions);
var ws_address = undefined

let layer = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
ws_map.addLayer(layer);


let apiKey = "05a95ef7b0714858b9f42275e94a149a",
    marker = null;


const addressSearchControl = L.control.addressSearch(apiKey, {
    position: 'topleft',

	//set it true to search addresses nearby first
    mapViewBias:true,

    //Text shown in the Address Search field when it's empty
    placeholder:"enter event location",

    // /Callback to notify when a user has selected an address
    resultCallback: (address) => {
		// If there is already a marker remove it
        if (marker) {
          	marker.remove();
        }
		//Prevent throwing Errors when the address search box is empty
		if (!address) {
				return;
		}
     	
		//add marker 
		marker = L.marker([address.lat, address.lon]).addTo(ws_map);
		//Sets the view of the map (geographical center and zoom) with the given animation options.
		ws_map.setView([address.lat, address.lon], 20);
        ws_address = address
      },

      //Callback to notify when new suggestions have been obtained for the entered text
      suggestionsCallback: (suggestions) => {
        console.log(suggestions);
      }
});


ws_map.addControl(addressSearchControl);


