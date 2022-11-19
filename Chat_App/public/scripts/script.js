//const socket = io('http://localhost:3000')
const socket = io();
const messageContainer = document.getElementById('message-container')
const messageForm = document.getElementById('send-container')
const messageInput = document.getElementById('message-input')

function scrollToBottom(){
  let messages = document.querySelector('#message-container').lastElementChild;
  messages.scrollIntoView();
}

const name = prompt("Insert your name:","")
const room = prompt("Enter the name of the room if you want to join:","")

if(name == "" || name == null){
  swal("Error!", "Insira o seu nome ", "error")
  .then((value) => {
    window.location.href='index.html'         
})
}
/*else if(room == "" || room == null){
  swal("Error!", "Insira um nome para o grupo ", "error")
  .then((value) => {
    window.location.href='index.html'  
})
}*/
else{
appendMessage(`${name} joined`)
socket.emit('new-user', name)
/*appendMessage(`${room} enter this "room"`)
socket.emit('aaa',room)*/
}


socket.on('chat-message', data => {
  appendMessage(`${data.name}: ${data.message}`)
})

socket.on('user-connected', name => {
  appendMessage(`${name} connected`)
  
})

socket.on('user-disconnected', name => {
  appendMessage(`${name} disconnected`)
})

//socket.on('updateUserList',function())

messageForm.addEventListener('submit', e => {
  e.preventDefault()
  const message = messageInput.value
  if(message == ""){
    console.log("Erro");
  }
  else{
  appendMessage(`You: ${message}`)
  socket.emit('send-chat-message', message)
  messageInput.value = ''
  }
  console.log(message);
  
  
})

function appendMessage(message) {
  const messageElement = document.createElement('div')
  messageElement.innerText = message
  messageContainer.append(messageElement)
  scrollToBottom();


}

