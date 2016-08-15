<?php

//stream output

//ob_start();

for ($i=0;$i<10;$i++) {
	echo $i."\n";
	//flush();
	sleep(2);
}


//ob_end_flush();