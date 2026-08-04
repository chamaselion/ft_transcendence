import axios from "axios"; // подключить библиотеку, которая делает http запросы

const API_URL = "http://localhost:3001/api/auth";

export function registerUser(data)
{
	return axios.post(`${API_URL}/register`, data);
}