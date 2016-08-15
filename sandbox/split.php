<?php

$txt = 'Filepath: / >> /media/yvesmeili/12E4-0E1E/Laptop Dell Karantina/Orangutan Project/SOCP/ORANGUTAN/OU CASE PICTURE/OU IN ACTION/Baby school (70).jpg';

//$splitted = explode('/',$txt);

$result = preg_replace('/\s|\d/', '', $txt);


echo "\n\n";

echo $txt;
print_r($result);

echo "\n\n";